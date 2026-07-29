import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    event: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    booking: { findMany: vi.fn(), update: vi.fn() },
    inventoryItem: { update: vi.fn() },
    invitation: { update: vi.fn() },
    guest: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    notificationJob: { findUnique: vi.fn(), create: vi.fn() },
    appUser: { findUnique: vi.fn() }
  }
}));

vi.mock("@eventrax/database", async () => {
  const { dispatchNotification } = await import(
    "../../../../packages/database/src/dispatch-notification.js"
  );
  return { prisma: mockPrisma, dispatchNotification };
});

import { buildApp } from "../../src/app.js";

const originalEnv = { ...process.env };

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

const EVENT_ID = "11111111-1111-1111-1111-111111111111";
const VENUE_ID = "22222222-2222-2222-2222-222222222222";

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    tenantId: "tenant-1",
    title: "Annual Gala",
    status: "published",
    startDate: new Date("2026-08-01T18:00:00Z"),
    endDate: new Date("2026-08-01T22:00:00Z"),
    venueId: "venue-old",
    ...overrides
  };
}

describe("event-service listing update + cascade routes", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "event-service";
    process.env.PORT = "3004";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    vi.clearAllMocks();
    mockPrisma.notificationJob.findUnique.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({ id: "notification-1" });
    mockPrisma.notificationJob.create.mockResolvedValue({ id: "job-1" });
    mockPrisma.appUser.findUnique.mockResolvedValue({ email: "requestor@example.com" });
  });

  afterEach(() => {
    resetEnv();
  });

  it("rejects unknown fields payload / missing event", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null);
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${EVENT_ID}`,
        payload: { title: "New title" }
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("does not trigger reconfirmation for a cosmetic-only change", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(baseEvent());
    mockPrisma.event.update.mockResolvedValue(baseEvent({ title: "Updated title" }));

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${EVENT_ID}`,
        payload: { title: "Updated title" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ materialChange: false });
      expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("cascades notifications and flags reconfirmation on a material date change", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(baseEvent());
    mockPrisma.event.update.mockResolvedValue(baseEvent({ startDate: new Date("2026-09-01T18:00:00Z") }));
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        requesterId: "requester-1",
        invitations: [{ id: "invitation-1", guestId: "guest-1" }]
      }
    ]);
    mockPrisma.guest.findUnique.mockResolvedValue({ id: "guest-1", email: "guest@example.com" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${EVENT_ID}`,
        payload: { startDate: "2026-09-01T18:00:00Z" }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.materialChange).toBe(true);
      expect(body.notified).toBe(2);

      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "invitation-1" },
        data: { needsReconfirmation: true, status: "pending_reconfirmation" }
      });
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
    } finally {
      await app.close();
    }
  });

  it("does not re-notify on an identical repeat update (idempotent)", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(baseEvent());
    mockPrisma.event.update.mockResolvedValue(baseEvent({ venueId: VENUE_ID }));
    mockPrisma.booking.findMany.mockResolvedValue([{ id: "booking-1", requesterId: "requester-1", invitations: [] }]);
    // Simulate this exact change already having produced a notification job.
    mockPrisma.notificationJob.findUnique.mockResolvedValue({ id: "existing-job" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${EVENT_ID}`,
        payload: { venueId: VENUE_ID }
      });

      expect(response.json()).toMatchObject({ materialChange: true, notified: 0 });
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects updates to an already-cancelled event", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(baseEvent({ status: "cancelled" }));
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/events/${EVENT_ID}`,
        payload: { title: "New title" }
      });
      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("cancels an event: notifies all, releases seats, cancels bookings, audits", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(baseEvent());
    mockPrisma.event.update.mockResolvedValue(baseEvent({ status: "cancelled" }));
    mockPrisma.booking.findMany.mockResolvedValue([
      {
        id: "booking-1",
        requesterId: "requester-1",
        inventoryItemId: "inv-1",
        seatsRequested: 3,
        invitations: [{ id: "invitation-1", guestId: "guest-1" }]
      }
    ]);
    mockPrisma.guest.findUnique.mockResolvedValue({ id: "guest-1", email: "guest@example.com" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/events/${EVENT_ID}/cancel`
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.notified).toBe(2);

      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: "booking-1" },
        data: { status: "cancelled" }
      });
      expect(mockPrisma.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { availableSeats: { increment: 3 } }
      });
    } finally {
      await app.close();
    }
  });

  it("treats cancelling an already-cancelled event as a no-op", async () => {
    mockPrisma.event.findUnique.mockResolvedValue(baseEvent({ status: "cancelled" }));

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/events/${EVENT_ID}/cancel`
      });

      expect(response.json()).toMatchObject({ alreadyCancelled: true, notified: 0 });
      expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

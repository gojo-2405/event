import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { findMany: vi.fn() },
    invitation: { findUnique: vi.fn(), update: vi.fn() },
    invitationAudit: { findMany: vi.fn(), createMany: vi.fn() },
    appUser: { findUnique: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    notificationJob: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn()
  }
}));

vi.mock("@eventrax/database", () => ({
  prisma: mockPrisma,
  writeInvitationAuditDiff: vi.fn()
}));

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

describe("booking-service notification routes", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "booking-service";
    process.env.PORT = "3003";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  });

  afterEach(() => {
    resetEnv();
  });

  it("queues an in-app notification and email job", async () => {
    mockPrisma.notificationJob.findUnique.mockResolvedValue(null);
    mockPrisma.appUser.findUnique.mockResolvedValue({ email: "tenant@example.com" });
    mockPrisma.notification.create.mockResolvedValue({ id: "notif-1" });
    mockPrisma.notificationJob.create.mockResolvedValue({ id: "job-1" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications/dispatch",
        payload: {
          tenantId: "22222222-2222-2222-2222-222222222222",
          userId: "11111111-1111-1111-1111-111111111111",
          type: "booking_update",
          title: "Booking approved",
          message: "Your booking has been approved.",
          templateKey: "booking-approved",
          idempotencyKey: "booking-123-approved",
          payload: { bookingId: "booking-123" }
        }
      });

      expect(response.statusCode).toBe(202);
      expect(mockPrisma.notification.create).toHaveBeenCalled();
      expect(mockPrisma.notificationJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipientEmail: "tenant@example.com",
            status: "queued",
            idempotencyKey: "booking-123-approved"
          })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns existing queued job for duplicate idempotency key", async () => {
    mockPrisma.notificationJob.findUnique.mockResolvedValue({
      id: "job-1",
      notificationId: "notif-1",
      notification: { id: "notif-1" }
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications/dispatch",
        payload: {
          tenantId: "22222222-2222-2222-2222-222222222222",
          userId: "11111111-1111-1111-1111-111111111111",
          email: "tenant@example.com",
          type: "booking_update",
          title: "Booking approved",
          message: "Your booking has been approved.",
          templateKey: "booking-approved",
          idempotencyKey: "booking-123-approved",
          payload: {}
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(response.json()).toEqual({
        jobId: "job-1",
        notificationId: "notif-1",
        queued: false
      });
    } finally {
      await app.close();
    }
  });

  it("lists notifications", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ id: "notif-1", title: "Title" }]);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/notifications?userId=11111111-1111-1111-1111-111111111111"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: [{ id: "notif-1", title: "Title" }] });
    } finally {
      await app.close();
    }
  });

  it("marks a notification as read", async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({ id: "notif-1" });
    mockPrisma.notification.update.mockResolvedValue({ id: "notif-1", status: "read" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/notifications/notif-1/read"
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "notif-1" },
          data: expect.objectContaining({ status: "read" })
        })
      );
    } finally {
      await app.close();
    }
  });
});

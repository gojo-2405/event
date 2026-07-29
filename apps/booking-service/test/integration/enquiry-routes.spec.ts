import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    booking: { findMany: vi.fn() },
    invitation: { findUnique: vi.fn(), update: vi.fn() },
    invitationAudit: { findMany: vi.fn(), createMany: vi.fn() },
    appUser: { findUnique: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    notificationJob: { findUnique: vi.fn(), create: vi.fn() },
    enquiry: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    enquiryDispatch: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn()
  }
}));

// reconcileEnquiryDispatch/parseEnquiryWebhookPayload/dispatchNotification/the terminal-
// statuses constant are imported from their source files directly (not via
// "@eventrax/database"'s index.ts) so this mock doesn't have to construct a real
// PrismaClient just to get a handful of pure/DI'd functions with no side effects of their own.
vi.mock("@eventrax/database", async () => {
  const { parseEnquiryWebhookPayload, reconcileEnquiryDispatch } = await import(
    "../../../../packages/database/src/reconcile-enquiry-dispatch.js"
  );
  const { dispatchNotification } = await import(
    "../../../../packages/database/src/dispatch-notification.js"
  );
  const { ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES } = await import(
    "../../../../packages/database/src/mirror-enquiry-status.js"
  );
  return {
    prisma: mockPrisma,
    writeInvitationAuditDiff: vi.fn(),
    parseEnquiryWebhookPayload,
    reconcileEnquiryDispatch,
    dispatchNotification,
    ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES
  };
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

describe("booking-service enquiry routes", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "booking-service";
    process.env.PORT = "3003";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    process.env.AOK_ENQUIRY_SOURCE_DEFAULT = "Eventrax";
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  });

  afterEach(() => {
    resetEnv();
  });

  it("creates an enquiry and enqueues its AOK dispatch in one transaction (E20-57 gap fix)", async () => {
    mockPrisma.enquiry.create.mockResolvedValue({ id: "22222222-2222-2222-2222-222222222222" });
    mockPrisma.enquiryDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      enquiryId: "22222222-2222-2222-2222-222222222222"
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries",
        payload: {
          tenantId: "11111111-1111-1111-1111-111111111111",
          submittedById: "33333333-3333-3333-3333-333333333333",
          mode: "public",
          details: "Need a venue for 50 guests",
          publicContact: { name: "Sam", surname: "JP", email: "sam@example.com" }
        }
      });

      expect(response.statusCode).toBe(201);
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "11111111-1111-1111-1111-111111111111",
            submittedById: "33333333-3333-3333-3333-333333333333",
            status: "submitted"
          })
        })
      );
      expect(mockPrisma.enquiryDispatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enquiryId: "22222222-2222-2222-2222-222222222222",
            dispatchKey: "22222222-2222-2222-2222-222222222222",
            status: "queued",
            maxAttempts: 4
          })
        })
      );
      expect(response.json()).toEqual({
        data: { enquiryId: "22222222-2222-2222-2222-222222222222", dispatchId: "dispatch-2" }
      });
    } finally {
      await app.close();
    }
  });

  it("persists preferredDate, budget, category, purpose, currency and taxAmount (wizard field-drop fix)", async () => {
    mockPrisma.enquiry.create.mockResolvedValue({ id: "22222222-2222-2222-2222-222222222222" });
    mockPrisma.enquiryDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      enquiryId: "22222222-2222-2222-2222-222222222222"
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries",
        payload: {
          tenantId: "11111111-1111-1111-1111-111111111111",
          submittedById: "33333333-3333-3333-3333-333333333333",
          mode: "public",
          details: "Need a venue for 50 guests",
          publicContact: { name: "Sam", surname: "JP", email: "sam@example.com" },
          category: "Corporate Hospitality",
          purpose: "Client relationship building",
          preferredDate: "2026-09-01",
          budget: 45000,
          currency: "USD",
          taxAmount: 3600
        }
      });

      expect(response.statusCode).toBe(201);
      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: "Corporate Hospitality",
            purpose: "Client relationship building",
            preferredDate: new Date("2026-09-01"),
            budget: 45000,
            currency: "USD",
            taxAmount: 3600
          })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("defaults currency and leaves the new wizard fields null when the caller omits them", async () => {
    mockPrisma.enquiry.create.mockResolvedValue({ id: "22222222-2222-2222-2222-222222222222" });
    mockPrisma.enquiryDispatch.create.mockResolvedValue({
      id: "dispatch-2",
      enquiryId: "22222222-2222-2222-2222-222222222222"
    });

    const app = await buildApp();
    try {
      await app.inject({
        method: "POST",
        url: "/api/v1/enquiries",
        payload: {
          tenantId: "11111111-1111-1111-1111-111111111111",
          submittedById: "33333333-3333-3333-3333-333333333333",
          mode: "public",
          details: "Need a venue for 50 guests"
        }
      });

      expect(mockPrisma.enquiry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: null,
            purpose: null,
            preferredDate: null,
            budget: null,
            currency: expect.any(String),
            taxAmount: null
          })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("rejects an unparseable preferredDate", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries",
        payload: {
          tenantId: "11111111-1111-1111-1111-111111111111",
          submittedById: "33333333-3333-3333-3333-333333333333",
          mode: "public",
          details: "Need a venue",
          preferredDate: "not-a-date"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects enquiry creation missing required fields", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries",
        payload: { tenantId: "11111111-1111-1111-1111-111111111111" }
      });

      expect(response.statusCode).toBe(400);
      expect(mockPrisma.enquiry.create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("queues an AOK enquiry dispatch using the enquiry id as the idempotency key", async () => {
    mockPrisma.enquiryDispatch.findUnique.mockResolvedValue(null);
    mockPrisma.enquiry.findUnique.mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111" });
    mockPrisma.enquiryDispatch.create.mockResolvedValue({
      id: "dispatch-1",
      enquiryId: "11111111-1111-1111-1111-111111111111"
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries/dispatch",
        payload: {
          enquiryId: "11111111-1111-1111-1111-111111111111",
          mode: "public",
          details: "Need hospitality package",
          publicContact: {
            name: "Sam",
            surname: "JP",
            email: "sam@example.com"
          }
        }
      });

      expect(response.statusCode).toBe(202);
      expect(mockPrisma.enquiryDispatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enquiryId: "11111111-1111-1111-1111-111111111111",
            dispatchKey: "11111111-1111-1111-1111-111111111111",
            maxAttempts: 4
          })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns an existing dispatch when the same enquiry is dispatched twice", async () => {
    mockPrisma.enquiryDispatch.findUnique.mockResolvedValue({
      id: "dispatch-1",
      enquiryId: "11111111-1111-1111-1111-111111111111"
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries/dispatch",
        payload: {
          enquiryId: "11111111-1111-1111-1111-111111111111",
          mode: "public",
          details: "Need hospitality package"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        dispatchId: "dispatch-1",
        enquiryId: "11111111-1111-1111-1111-111111111111",
        queued: false
      });
      expect(mockPrisma.enquiryDispatch.findUnique).toHaveBeenCalledWith({
        where: { dispatchKey: "11111111-1111-1111-1111-111111111111" }
      });
    } finally {
      await app.close();
    }
  });

  it("cancels an enquiry and notifies the requestor (E20-55-style cancel for enquiries)", async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      tenantId: "tenant-1",
      submittedById: "user-1",
      status: "in_progress",
      title: "Annual partner summit"
    });
    mockPrisma.enquiry.update.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "cancelled"
    });
    mockPrisma.notificationJob.findUnique.mockResolvedValue(null);
    mockPrisma.appUser.findUnique.mockResolvedValue({ email: "requestor@example.com" });
    mockPrisma.notification.create.mockResolvedValue({ id: "notif-1" });
    mockPrisma.notificationJob.create.mockResolvedValue({ id: "job-1" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries/11111111-1111-1111-1111-111111111111/cancel"
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.enquiry.update).toHaveBeenCalledWith({
        where: { id: "11111111-1111-1111-1111-111111111111" },
        data: expect.objectContaining({ status: "cancelled", cancelledAt: expect.any(Date) })
      });
      expect(response.json()).toEqual(
        expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }), notified: true })
      );
    } finally {
      await app.close();
    }
  });

  it("returns alreadyCancelled instead of erroring on a repeat cancel", async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "cancelled"
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries/11111111-1111-1111-1111-111111111111/cancel"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(
        expect.objectContaining({ alreadyCancelled: true, notified: false })
      );
      expect(mockPrisma.enquiry.update).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("refuses to cancel an enquiry that has already reached a terminal AOK-driven status", async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "accepted"
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries/11111111-1111-1111-1111-111111111111/cancel"
      });

      expect(response.statusCode).toBe(400);
      expect(mockPrisma.enquiry.update).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("404s cancelling an enquiry that doesn't exist", async () => {
    mockPrisma.enquiry.findUnique.mockResolvedValue(null);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/enquiries/11111111-1111-1111-1111-111111111111/cancel"
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("lists enquiry dispatches", async () => {
    mockPrisma.enquiryDispatch.findMany.mockResolvedValue([{ id: "dispatch-1" }]);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/enquiries/11111111-1111-1111-1111-111111111111/dispatches"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: [{ id: "dispatch-1" }] });
    } finally {
      await app.close();
    }
  });

  it("reconciles AOK webhook payloads", async () => {
    mockPrisma.enquiryDispatch.findFirst.mockResolvedValue({ id: "dispatch-1" });
    mockPrisma.enquiryDispatch.update.mockResolvedValue({ id: "dispatch-1", status: "reconciled" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/webhooks/aok/enquiries",
        payload: {
          action: "BookingSpawned",
          enquiryId: 123,
          bookingId: 999
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.enquiryDispatch.update).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

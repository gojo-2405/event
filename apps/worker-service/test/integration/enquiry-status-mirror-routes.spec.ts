import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockMirrorEnquiryStatusFromBooking } = vi.hoisted(() => ({
  mockPrisma: {
    notificationJob: { count: vi.fn() },
    enquiryDispatch: { findMany: vi.fn(), update: vi.fn() },
    enquiry: { findMany: vi.fn(), update: vi.fn() },
    crmInboundEvent: { findMany: vi.fn(), update: vi.fn() }
  },
  mockMirrorEnquiryStatusFromBooking: vi.fn()
}));

vi.mock("@eventrax/database", () => ({
  prisma: mockPrisma,
  routeInboundFlow: vi.fn(),
  mirrorEnquiryStatusFromBooking: mockMirrorEnquiryStatusFromBooking,
  ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES: ["accepted", "closed", "cancelled"],
  AOK_WEBHOOK_CATEGORIES: ["booking", "client", "contact", "enquiry", "organisation"]
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

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

describe("worker-service enquiry status-mirror drain", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "worker-service";
    process.env.PORT = "3005";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnv();
  });

  it("only queries enquiries with a crmBookingRef and a non-terminal status", async () => {
    mockPrisma.enquiry.findMany.mockResolvedValue([]);

    const app = await buildApp();
    try {
      await app.inject({ method: "POST", url: "/api/v1/jobs/enquiries/status-mirror/drain" });

      expect(mockPrisma.enquiry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            crmBookingRef: { not: null },
            NOT: { status: { in: ["accepted", "closed", "cancelled"] } }
          }
        })
      );
    } finally {
      await app.close();
    }
  });

  it("syncs each enquiry via mirrorEnquiryStatusFromBooking", async () => {
    mockPrisma.enquiry.findMany.mockResolvedValue([
      { id: "enquiry-1", crmBookingRef: 456, status: "in_progress" }
    ]);
    mockMirrorEnquiryStatusFromBooking.mockResolvedValue({ handled: true, status: "proposals_sent" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/enquiries/status-mirror/drain"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ processed: 1, synced: 1, unknown: 0, failed: 0 });
      expect(mockMirrorEnquiryStatusFromBooking).toHaveBeenCalledWith(
        mockPrisma,
        expect.anything(),
        { enquiryId: "enquiry-1", bookingId: 456 }
      );
    } finally {
      await app.close();
    }
  });

  it("counts an unknown_enquiry result without throwing", async () => {
    mockPrisma.enquiry.findMany.mockResolvedValue([
      { id: "enquiry-1", crmBookingRef: 456, status: "in_progress" }
    ]);
    mockMirrorEnquiryStatusFromBooking.mockResolvedValue({ handled: false, reason: "unknown_enquiry" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/enquiries/status-mirror/drain"
      });

      expect(response.json()).toEqual({ processed: 1, synced: 0, unknown: 1, failed: 0 });
    } finally {
      await app.close();
    }
  });

  it("counts a thrown error as failed without stopping the batch", async () => {
    mockPrisma.enquiry.findMany.mockResolvedValue([
      { id: "enquiry-1", crmBookingRef: 456, status: "in_progress" },
      { id: "enquiry-2", crmBookingRef: 789, status: "in_progress" }
    ]);
    mockMirrorEnquiryStatusFromBooking
      .mockRejectedValueOnce(new Error("AOK request failed with status 500"))
      .mockResolvedValueOnce({ handled: true, status: "accepted" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/enquiries/status-mirror/drain"
      });

      expect(response.json()).toEqual({ processed: 2, synced: 1, unknown: 0, failed: 1 });
    } finally {
      await app.close();
    }
  });
});

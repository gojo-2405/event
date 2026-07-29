import { describe, expect, it, vi } from "vitest";

import {
  mapAokBookingStatusToEnquiryStatus,
  mirrorEnquiryStatusFromBooking
} from "../src/mirror-enquiry-status.js";

function buildPrismaClient(overrides: Record<string, unknown> = {}) {
  return {
    enquiry: {
      findUnique: vi.fn().mockResolvedValue({ id: "enquiry-1", tenantId: "tenant-1", submittedById: "user-1" }),
      update: vi.fn().mockResolvedValue({ id: "enquiry-1" })
    },
    enquiryProposal: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "proposal-1" }),
      update: vi.fn().mockResolvedValue({ id: "proposal-1" })
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notification-1" })
    },
    notificationJob: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "job-1" })
    },
    appUser: {
      findUnique: vi.fn().mockResolvedValue({ email: "requestor@example.com" })
    },
    ...overrides
  };
}

describe("mapAokBookingStatusToEnquiryStatus", () => {
  it.each([
    ["InNegotiation", "in_progress"],
    ["Unreviewed", "in_progress"],
    ["Offered", "proposals_sent"],
    ["Accepted", "accepted"],
    ["Completed", "closed"],
    ["Cancelled", "cancelled"]
  ])("maps AOK status %s to %s", (aokStatus, expected) => {
    expect(mapAokBookingStatusToEnquiryStatus(aokStatus)).toBe(expected);
  });

  it("falls back to in_progress for an unrecognized status", () => {
    expect(mapAokBookingStatusToEnquiryStatus("SomethingNew")).toBe("in_progress");
  });
});

describe("mirrorEnquiryStatusFromBooking", () => {
  it("returns unknown_enquiry when the enquiry doesn't exist", async () => {
    const prismaClient = buildPrismaClient({
      enquiry: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() }
    });
    const aokClient = { getBooking: vi.fn() };

    const result = await mirrorEnquiryStatusFromBooking(prismaClient as any, aokClient, {
      enquiryId: "missing-enquiry",
      bookingId: 456
    });

    expect(result).toEqual({ handled: false, reason: "unknown_enquiry" });
    expect(aokClient.getBooking).not.toHaveBeenCalled();
  });

  it("maps booking status onto the enquiry and syncs crmLastSyncAt", async () => {
    const prismaClient = buildPrismaClient();
    const aokClient = {
      getBooking: vi.fn().mockResolvedValue({ id: 456, status: "Offered", offers: [] })
    };

    const result = await mirrorEnquiryStatusFromBooking(prismaClient as any, aokClient, {
      enquiryId: "enquiry-1",
      bookingId: 456
    });

    expect(result.handled).toBe(true);
    expect(result.status).toBe("proposals_sent");
    expect(prismaClient.enquiry.update).toHaveBeenCalledWith({
      where: { id: "enquiry-1" },
      data: { status: "proposals_sent", crmLastSyncAt: expect.any(Date) }
    });
  });

  it("upserts EnquiryProposal rows from booking offers, deduped by (enquiryId, crmOfferedAt)", async () => {
    const prismaClient = buildPrismaClient();
    const aokClient = {
      getBooking: vi.fn().mockResolvedValue({
        id: 456,
        status: "Offered",
        offers: [
          { offered: "2026-07-01T10:00:00Z", offeredBy: "Ops Team", accepted: undefined },
          { offered: "2026-07-05T10:00:00Z", offeredBy: "Ops Team", accepted: true }
        ]
      })
    };

    const result = await mirrorEnquiryStatusFromBooking(prismaClient as any, aokClient, {
      enquiryId: "enquiry-1",
      bookingId: 456
    });

    expect(result.proposalsSynced).toBe(2);
    expect(prismaClient.enquiryProposal.create).toHaveBeenCalledTimes(2);
    // An explicitly accepted offer overrides the booking-level status mapping.
    expect(result.status).toBe("accepted");
  });

  it("updates an existing proposal instead of creating a duplicate on repeat sync", async () => {
    const prismaClient = buildPrismaClient({
      enquiryProposal: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing-proposal" }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "existing-proposal" })
      }
    });
    const aokClient = {
      getBooking: vi.fn().mockResolvedValue({
        id: 456,
        status: "Offered",
        offers: [{ offered: "2026-07-01T10:00:00Z", offeredBy: "Ops Team" }]
      })
    };

    await mirrorEnquiryStatusFromBooking(prismaClient as any, aokClient, {
      enquiryId: "enquiry-1",
      bookingId: 456
    });

    expect(prismaClient.enquiryProposal.create).not.toHaveBeenCalled();
    expect(prismaClient.enquiryProposal.update).toHaveBeenCalledWith({
      where: { id: "existing-proposal" },
      data: expect.objectContaining({ isSelected: false })
    });
  });

  it("notifies the requestor once per distinct status (idempotent on repeat polls)", async () => {
    const prismaClient = buildPrismaClient();
    const aokClient = {
      getBooking: vi.fn().mockResolvedValue({ id: 456, status: "Accepted", offers: [] })
    };

    const result = await mirrorEnquiryStatusFromBooking(prismaClient as any, aokClient, {
      enquiryId: "enquiry-1",
      bookingId: 456
    });

    expect(result.notified).toBe(true);
    expect(prismaClient.notificationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: "enquiry-status-mirror:enquiry-1:accepted" })
      })
    );
  });

  it("does not re-notify when a notification job with the same idempotency key already exists", async () => {
    const prismaClient = buildPrismaClient({
      notificationJob: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing-job" }),
        create: vi.fn()
      }
    });
    const aokClient = {
      getBooking: vi.fn().mockResolvedValue({ id: 456, status: "Accepted", offers: [] })
    };

    const result = await mirrorEnquiryStatusFromBooking(prismaClient as any, aokClient, {
      enquiryId: "enquiry-1",
      bookingId: 456
    });

    expect(result.notified).toBe(false);
    expect(prismaClient.notificationJob.create).not.toHaveBeenCalled();
  });

  it("skips notification when the enquiry has no submittedById", async () => {
    const prismaClient = buildPrismaClient({
      enquiry: {
        findUnique: vi.fn().mockResolvedValue({ id: "enquiry-1", tenantId: "tenant-1", submittedById: null }),
        update: vi.fn().mockResolvedValue({ id: "enquiry-1" })
      }
    });
    const aokClient = {
      getBooking: vi.fn().mockResolvedValue({ id: 456, status: "Accepted", offers: [] })
    };

    const result = await mirrorEnquiryStatusFromBooking(prismaClient as any, aokClient, {
      enquiryId: "enquiry-1",
      bookingId: 456
    });

    expect(result.notified).toBe(false);
    expect(prismaClient.notification.create).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import { routeInboundFlow } from "../src/route-inbound-flow.js";

describe("routeInboundFlow", () => {
  it("processes a known enquiry payload via reconcileEnquiryDispatch", async () => {
    const prismaClient = {
      enquiryDispatch: {
        findFirst: vi.fn().mockResolvedValue({ id: "dispatch-1" }),
        update: vi.fn().mockResolvedValue({ id: "dispatch-1", status: "processed" })
      },
      enquiry: { update: vi.fn() }
    };

    const outcome = await routeInboundFlow(prismaClient, "enquiry", {
      action: "Ignored",
      enquiryId: 123
    });

    expect(outcome).toEqual({ status: "processed" });
    expect(prismaClient.enquiry.update).not.toHaveBeenCalled();
  });

  it("parks an enquiry payload that doesn't match the known shape", async () => {
    const prismaClient = {
      enquiryDispatch: { findFirst: vi.fn(), update: vi.fn() },
      enquiry: { update: vi.fn() }
    };

    const outcome = await routeInboundFlow(prismaClient, "enquiry", { nonsense: true });

    expect(outcome.status).toBe("parked");
  });

  it("parks an enquiry payload with no matching dispatch", async () => {
    const prismaClient = {
      enquiryDispatch: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
      enquiry: { update: vi.fn() }
    };

    const outcome = await routeInboundFlow(prismaClient, "enquiry", { enquiryId: 999 });

    expect(outcome.status).toBe("parked");
  });

  it("records crmBookingRef on the enquiry when action=BookingSpawned (E20-58)", async () => {
    const prismaClient = {
      enquiryDispatch: {
        findFirst: vi.fn().mockResolvedValue({ id: "dispatch-1" }),
        update: vi.fn().mockResolvedValue({ id: "dispatch-1", enquiryId: "enquiry-1", status: "reconciled" })
      },
      enquiry: { update: vi.fn().mockResolvedValue({ id: "enquiry-1" }) }
    };

    const outcome = await routeInboundFlow(prismaClient, "enquiry", {
      action: "BookingSpawned",
      enquiryId: 123,
      bookingId: 456
    });

    expect(outcome).toEqual({ status: "processed" });
    expect(prismaClient.enquiry.update).toHaveBeenCalledWith({
      where: { id: "enquiry-1" },
      data: { crmBookingRef: 456 }
    });
  });

  it("does not touch the enquiry if BookingSpawned resolves to no dispatch enquiryId", async () => {
    const prismaClient = {
      enquiryDispatch: {
        findFirst: vi.fn().mockResolvedValue({ id: "dispatch-1" }),
        update: vi.fn().mockResolvedValue({ id: "dispatch-1", status: "reconciled" })
      },
      enquiry: { update: vi.fn() }
    };

    const outcome = await routeInboundFlow(prismaClient, "enquiry", {
      action: "BookingSpawned",
      enquiryId: 123,
      bookingId: 456
    });

    expect(outcome).toEqual({ status: "processed" });
    expect(prismaClient.enquiry.update).not.toHaveBeenCalled();
  });

  it.each(["booking", "client", "contact", "organisation"] as const)(
    "parks the %s category (no handler yet)",
    async (category) => {
      const prismaClient = {
        enquiryDispatch: { findFirst: vi.fn(), update: vi.fn() },
        enquiry: { update: vi.fn() }
      };
      const outcome = await routeInboundFlow(prismaClient, category, { anything: true });
      expect(outcome.status).toBe("parked");
    }
  );
});

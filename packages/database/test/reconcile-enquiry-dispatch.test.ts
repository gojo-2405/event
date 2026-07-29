import { describe, expect, it, vi } from "vitest";

import { parseEnquiryWebhookPayload, reconcileEnquiryDispatch } from "../src/reconcile-enquiry-dispatch.js";

describe("parseEnquiryWebhookPayload", () => {
  it("accepts a valid BookingSpawned payload", () => {
    const result = parseEnquiryWebhookPayload({
      action: "BookingSpawned",
      enquiryId: 123,
      bookingId: 456
    });

    expect(result).toEqual({ action: "BookingSpawned", enquiryId: 123, bookingId: 456 });
  });

  it("rejects a payload missing enquiryId", () => {
    expect(parseEnquiryWebhookPayload({ action: "Ignored" })).toBeNull();
  });

  it("rejects a payload with an unknown action", () => {
    expect(parseEnquiryWebhookPayload({ action: "SomethingElse", enquiryId: 1 })).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseEnquiryWebhookPayload("not an object")).toBeNull();
    expect(parseEnquiryWebhookPayload(null)).toBeNull();
  });
});

describe("reconcileEnquiryDispatch", () => {
  it("returns handled: false when no dispatch matches the crmRef", async () => {
    const prismaClient = {
      enquiryDispatch: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn()
      }
    };

    const result = await reconcileEnquiryDispatch(prismaClient, { enquiryId: 123 });

    expect(result).toEqual({ handled: false });
    expect(prismaClient.enquiryDispatch.update).not.toHaveBeenCalled();
  });

  it("marks the dispatch reconciled on BookingSpawned", async () => {
    const prismaClient = {
      enquiryDispatch: {
        findFirst: vi.fn().mockResolvedValue({ id: "dispatch-1" }),
        update: vi.fn().mockResolvedValue({ id: "dispatch-1", status: "reconciled" })
      }
    };

    const result = await reconcileEnquiryDispatch(prismaClient, {
      action: "BookingSpawned",
      enquiryId: 123,
      bookingId: 456
    });

    expect(result.handled).toBe(true);
    expect(prismaClient.enquiryDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dispatch-1" },
        data: expect.objectContaining({ status: "reconciled" })
      })
    );
  });

  it("marks the dispatch processed (not reconciled) on Ignored", async () => {
    const prismaClient = {
      enquiryDispatch: {
        findFirst: vi.fn().mockResolvedValue({ id: "dispatch-1" }),
        update: vi.fn().mockResolvedValue({ id: "dispatch-1", status: "processed" })
      }
    };

    await reconcileEnquiryDispatch(prismaClient, { action: "Ignored", enquiryId: 123 });

    expect(prismaClient.enquiryDispatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "processed" })
      })
    );
  });
});

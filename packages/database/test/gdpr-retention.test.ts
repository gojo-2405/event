import { describe, expect, it, vi } from "vitest";

import { eraseGuest, hasActiveDependency, runRetentionSweep } from "../src/gdpr-retention.js";

function buildClient(overrides: Record<string, unknown> = {}) {
  return {
    guest: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({})
    },
    invitation: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({})
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    ...overrides
  };
}

describe("hasActiveDependency", () => {
  it("is true when a booking is not in a terminal status", async () => {
    const client = buildClient({
      invitation: {
        findMany: vi.fn().mockResolvedValue([
          { id: "inv-1", bookingId: "b1", booking: { status: "confirmed", event: { endDate: new Date("2020-01-01") } } }
        ]),
        updateMany: vi.fn()
      }
    });

    expect(await hasActiveDependency(client as any, "guest-1")).toBe(true);
  });

  it("is true when the booking is terminal but the event hasn't finished yet", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const client = buildClient({
      invitation: {
        findMany: vi.fn().mockResolvedValue([
          { id: "inv-1", bookingId: "b1", booking: { status: "completed", event: { endDate: future } } }
        ]),
        updateMany: vi.fn()
      }
    });

    expect(await hasActiveDependency(client as any, "guest-1")).toBe(true);
  });

  it("is true when the event has no end date at all (treated as open-ended)", async () => {
    const client = buildClient({
      invitation: {
        findMany: vi.fn().mockResolvedValue([
          { id: "inv-1", bookingId: "b1", booking: { status: "cancelled", event: { endDate: null } } }
        ]),
        updateMany: vi.fn()
      }
    });

    expect(await hasActiveDependency(client as any, "guest-1")).toBe(true);
  });

  it("is false when the booking is terminal and the event has already finished", async () => {
    const past = new Date("2020-01-01");
    const client = buildClient({
      invitation: {
        findMany: vi.fn().mockResolvedValue([
          { id: "inv-1", bookingId: "b1", booking: { status: "completed", event: { endDate: past } } }
        ]),
        updateMany: vi.fn()
      }
    });

    expect(await hasActiveDependency(client as any, "guest-1")).toBe(false);
  });

  it("is false when there are no invitations at all", async () => {
    const client = buildClient();
    expect(await hasActiveDependency(client as any, "guest-1")).toBe(false);
  });
});

describe("runRetentionSweep", () => {
  const pastCreatedAt = new Date("2020-01-01");

  it("skips policies for entities other than guest", async () => {
    const client = buildClient();
    const result = await runRetentionSweep(client as any, {
      id: "policy-1", tenantId: null, entity: "app_user", retainDays: 30, mode: "purge", isActive: true
    });
    expect(result).toEqual({ scanned: 0, processed: 0, retainedActive: 0 });
    expect(client.guest.findMany).not.toHaveBeenCalled();
  });

  it("skips inactive policies", async () => {
    const client = buildClient();
    const result = await runRetentionSweep(client as any, {
      id: "policy-1", tenantId: null, entity: "guest", retainDays: 30, mode: "purge", isActive: false
    });
    expect(result).toEqual({ scanned: 0, processed: 0, retainedActive: 0 });
  });

  it("anonymises + audits an eligible guest with no active dependency", async () => {
    const client = buildClient({
      guest: {
        findMany: vi.fn().mockResolvedValue([{ id: "guest-1", tenantId: "tenant-1", createdAt: pastCreatedAt, deletedAt: null }]),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({})
      },
      invitation: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({}) }
    });

    const result = await runRetentionSweep(client as any, {
      id: "policy-1", tenantId: null, entity: "guest", retainDays: 30, mode: "anonymise", isActive: true
    });

    expect(result).toEqual({ scanned: 1, processed: 1, retainedActive: 0 });
    expect(client.guest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "guest-1" },
        data: expect.objectContaining({ email: null, firstName: "[redacted]", lastName: "[redacted]" })
      })
    );
    expect(client.invitation.updateMany).toHaveBeenCalledWith({
      where: { guestId: "guest-1" },
      data: { token: null, tokenExpiresAt: expect.any(Date) }
    });
    expect(client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "gdpr.guest_anonymised", entityId: "guest-1" })
      })
    );
  });

  it("retains a guest with an active dependency instead of anonymising it", async () => {
    const client = buildClient({
      guest: {
        findMany: vi.fn().mockResolvedValue([{ id: "guest-1", tenantId: "tenant-1", createdAt: pastCreatedAt, deletedAt: null }]),
        findUnique: vi.fn(),
        update: vi.fn()
      },
      invitation: {
        findMany: vi.fn().mockResolvedValue([
          { id: "inv-1", bookingId: "b1", booking: { status: "confirmed", event: { endDate: null } } }
        ]),
        updateMany: vi.fn()
      }
    });

    const result = await runRetentionSweep(client as any, {
      id: "policy-1", tenantId: null, entity: "guest", retainDays: 30, mode: "purge", isActive: true
    });

    expect(result).toEqual({ scanned: 1, processed: 0, retainedActive: 1 });
    expect(client.guest.update).not.toHaveBeenCalled();
    expect(client.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("eraseGuest", () => {
  it("returns not_found for a missing guest", async () => {
    const client = buildClient({ guest: { findMany: vi.fn(), findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() } });
    const result = await eraseGuest(client as any, "missing-guest", "actor-1");
    expect(result).toEqual({ erased: false, reason: "not_found" });
  });

  it("erases and audits a guest regardless of active dependency", async () => {
    const client = buildClient({
      guest: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "guest-1", tenantId: "tenant-1", createdAt: new Date(), deletedAt: null }),
        update: vi.fn().mockResolvedValue({})
      },
      invitation: {
        // Even with an active (non-terminal) booking, erasure should proceed — unlike the
        // policy sweep, this is not gated on hasActiveDependency.
        findMany: vi.fn().mockResolvedValue([
          { id: "inv-1", bookingId: "b1", booking: { status: "confirmed", event: { endDate: null } } }
        ]),
        updateMany: vi.fn().mockResolvedValue({})
      }
    });

    const result = await eraseGuest(client as any, "guest-1", "requestor@example.com");

    expect(result).toEqual({ erased: true });
    expect(client.guest.update).toHaveBeenCalled();
    expect(client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "gdpr.guest_erased", actor: "requestor@example.com" })
      })
    );
  });
});

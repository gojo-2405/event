import { describe, expect, it, vi } from "vitest";

import { dispatchNotification } from "../src/dispatch-notification.js";

function buildClient(overrides: Record<string, unknown> = {}) {
  return {
    notification: { create: vi.fn().mockResolvedValue({ id: "notification-1" }) },
    notificationJob: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "job-1" })
    },
    appUser: { findUnique: vi.fn().mockResolvedValue({ email: "user@example.com" }) },
    ...overrides
  };
}

describe("dispatchNotification", () => {
  it("creates a Notification + NotificationJob and resolves email via appUser for a userId recipient", async () => {
    const client = buildClient();

    const result = await dispatchNotification(client as any, {
      tenantId: "tenant-1",
      userId: "user-1",
      type: "listing.updated",
      title: "Title",
      message: "Message",
      templateKey: "listing-updated",
      idempotencyKey: "key-1"
    });

    expect(result.dispatched).toBe(true);
    expect(client.appUser.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { email: true }
    });
    expect(client.notificationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipientEmail: "user@example.com" }) })
    );
  });

  it("uses an explicit email directly for recipients with no AppUser account (e.g. Guests)", async () => {
    const client = buildClient();

    const result = await dispatchNotification(client as any, {
      tenantId: "tenant-1",
      email: "guest@example.com",
      type: "listing.updated",
      title: "Title",
      message: "Message",
      templateKey: "listing-updated-guest",
      idempotencyKey: "key-2"
    });

    expect(result.dispatched).toBe(true);
    expect(client.appUser.findUnique).not.toHaveBeenCalled();
    expect(client.notificationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipientEmail: "guest@example.com" }) })
    );
  });

  it("skips dispatch when a job with the same idempotency key already exists", async () => {
    const client = buildClient({
      notificationJob: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing-job" }),
        create: vi.fn()
      }
    });

    const result = await dispatchNotification(client as any, {
      tenantId: "tenant-1",
      email: "guest@example.com",
      type: "listing.updated",
      title: "Title",
      message: "Message",
      templateKey: "listing-updated-guest",
      idempotencyKey: "key-3"
    });

    expect(result).toEqual({ dispatched: false, reason: "duplicate" });
    expect(client.notification.create).not.toHaveBeenCalled();
  });

  it("skips dispatch when no email can be resolved", async () => {
    const client = buildClient({
      appUser: { findUnique: vi.fn().mockResolvedValue({ email: null }) }
    });

    const result = await dispatchNotification(client as any, {
      tenantId: "tenant-1",
      userId: "user-1",
      type: "listing.updated",
      title: "Title",
      message: "Message",
      templateKey: "listing-updated",
      idempotencyKey: "key-4"
    });

    expect(result).toEqual({ dispatched: false, reason: "no_recipient_email" });
  });
});

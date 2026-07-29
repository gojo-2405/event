import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    crmInboundEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("@eventrax/database", () => ({
  prisma: mockPrisma
}));

import { buildApp } from "../../src/app.js";

const originalEnv = { ...process.env };
const secret = "test-only-placeholder-secret-do-not-use";

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

function sign(body: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`v1:${timestamp}:${body}`).digest("hex");
}

function signedHeaders(body: string, overrides: Record<string, string> = {}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return {
    "content-type": "application/json",
    "x-api-signature": sign(body, timestamp),
    "x-api-timestamp": timestamp,
    "x-api-event": "event-guid-1",
    "x-api-attempt": "attempt-guid-1",
    ...overrides
  };
}

describe("booking-service integration webhook routes", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "booking-service";
    process.env.PORT = "3003";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    process.env.AOK_ENQUIRY_SOURCE_DEFAULT = "Eventrax";
    process.env.AOK_WEBHOOK_SECRET = secret;
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnv();
  });

  it("returns 404 for an unknown category", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/integration/webhooks/3d/not-a-real-category",
        payload: {}
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("rejects an invalid signature with 401", async () => {
    const app = await buildApp();
    try {
      const body = JSON.stringify({ enquiryId: 1 });
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/integration/webhooks/3d/enquiry",
        headers: {
          "content-type": "application/json",
          "x-api-signature": "f".repeat(64),
          "x-api-timestamp": Math.floor(Date.now() / 1000).toString(),
          "x-api-event": "event-guid-1"
        },
        payload: body
      });

      expect(response.statusCode).toBe(401);
      expect(mockPrisma.crmInboundEvent.create).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("accepts a validly signed request, persists it, and returns 202", async () => {
    mockPrisma.crmInboundEvent.findUnique.mockResolvedValue(null);
    mockPrisma.crmInboundEvent.create.mockResolvedValue({ id: "event-row-1", status: "received" });

    const app = await buildApp();
    try {
      const body = JSON.stringify({ action: "Ignored", enquiryId: 1 });
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/integration/webhooks/3d/enquiry",
        headers: signedHeaders(body),
        payload: body
      });

      expect(response.statusCode).toBe(202);
      expect(mockPrisma.crmInboundEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flow: "enquiry",
            idempotencyKey: "event-guid-1",
            externalRef: "event-guid-1",
            signatureValid: true,
            status: "received",
            maxAttempts: 4
          })
        })
      );
    } finally {
      await app.close();
    }
  });

  it.each(["received", "retrying", "processed", "dead_letter"])(
    "returns 409 for any redelivery of the same X-API-Event, regardless of status (%s)",
    async (status) => {
      mockPrisma.crmInboundEvent.findUnique.mockResolvedValue({ id: "event-row-1", status });

      const app = await buildApp();
      try {
        const body = JSON.stringify({ action: "Ignored", enquiryId: 1 });
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/integration/webhooks/3d/enquiry",
          headers: signedHeaders(body),
          payload: body
        });

        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({ data: { id: "event-row-1", status } });
        expect(mockPrisma.crmInboundEvent.create).not.toHaveBeenCalled();
        expect(mockPrisma.crmInboundEvent.update).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    }
  );

  it("requires the X-API-Event header even with a valid signature", async () => {
    const app = await buildApp();
    try {
      const body = JSON.stringify({ enquiryId: 1 });
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/integration/webhooks/3d/enquiry",
        headers: signedHeaders(body, { "x-api-event": "" }),
        payload: body
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});

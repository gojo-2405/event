import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockRouteInboundFlow } = vi.hoisted(() => ({
  mockPrisma: {
    notificationJob: { count: vi.fn() },
    enquiryDispatch: { findMany: vi.fn(), update: vi.fn() },
    enquiry: { update: vi.fn() },
    crmInboundEvent: {
      findMany: vi.fn(),
      update: vi.fn()
    }
  },
  mockRouteInboundFlow: vi.fn()
}));

vi.mock("@eventrax/database", () => ({
  prisma: mockPrisma,
  routeInboundFlow: mockRouteInboundFlow,
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

describe("worker-service integration job routes", () => {
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

  const baseEvent = {
    id: "event-1",
    flow: "enquiry",
    idempotencyKey: "event-guid-1",
    rawPayload: { body: { action: "Ignored", enquiryId: 1 }, attemptId: "attempt-guid-1" },
    attemptCount: 0,
    maxAttempts: 4
  };

  it("marks a successfully routed event as processed", async () => {
    mockPrisma.crmInboundEvent.findMany.mockResolvedValue([{ ...baseEvent }]);
    mockRouteInboundFlow.mockResolvedValue({ status: "processed" });

    const app = await buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/v1/jobs/integration/drain" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ processed: 1, handled: 1, parked: 0, retried: 0, deadLettered: 0 });
      expect(mockPrisma.crmInboundEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "event-1" },
          data: expect.objectContaining({ status: "processed", lastError: null })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("marks a parked outcome as processed with a note, not as a failure", async () => {
    mockPrisma.crmInboundEvent.findMany.mockResolvedValue([{ ...baseEvent, flow: "booking" }]);
    mockRouteInboundFlow.mockResolvedValue({ status: "parked", note: "booking category has no handler yet" });

    const app = await buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/v1/jobs/integration/drain" });

      expect(response.json()).toMatchObject({ processed: 1, handled: 1, parked: 1, retried: 0, deadLettered: 0 });
      expect(mockPrisma.crmInboundEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "processed",
            lastError: "booking category has no handler yet"
          })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("retries when the router throws, before the 4th attempt", async () => {
    mockPrisma.crmInboundEvent.findMany.mockResolvedValue([{ ...baseEvent, attemptCount: 1 }]);
    mockRouteInboundFlow.mockRejectedValue(new Error("boom"));

    const app = await buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/v1/jobs/integration/drain" });

      expect(response.json()).toMatchObject({ processed: 1, handled: 0, retried: 1, deadLettered: 0 });
      expect(mockPrisma.crmInboundEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "retrying" }) })
      );
    } finally {
      await app.close();
    }
  });

  it("dead-letters on the 4th failure", async () => {
    mockPrisma.crmInboundEvent.findMany.mockResolvedValue([{ ...baseEvent, attemptCount: 3 }]);
    mockRouteInboundFlow.mockRejectedValue(new Error("boom"));

    const app = await buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/v1/jobs/integration/drain" });

      expect(response.json()).toMatchObject({ processed: 1, deadLettered: 1 });
      expect(mockPrisma.crmInboundEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "dead_letter" }) })
      );
    } finally {
      await app.close();
    }
  });

  it("lists dead-lettered inbound events", async () => {
    mockPrisma.crmInboundEvent.findMany.mockResolvedValue([{ id: "event-dead-1", status: "dead_letter" }]);

    const app = await buildApp();
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/jobs/integration/dlq" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: [{ id: "event-dead-1", status: "dead_letter" }] });
    } finally {
      await app.close();
    }
  });

  it("requeues dead-lettered events on reconcile", async () => {
    mockPrisma.crmInboundEvent.findMany.mockResolvedValue([
      { id: "event-dead-1", status: "dead_letter" },
      { id: "event-dead-2", status: "dead_letter" }
    ]);

    const app = await buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/v1/jobs/integration/reconcile" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ requeued: 2 });
      expect(mockPrisma.crmInboundEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "event-dead-1" },
          data: expect.objectContaining({ status: "retrying" })
        })
      );
    } finally {
      await app.close();
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    notificationJob: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("@eventrax/database", () => ({
  prisma: mockPrisma
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

describe("worker-service notification job routes", () => {
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

  it("reports queue health", async () => {
    mockPrisma.notificationJob.count.mockResolvedValue(3);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/jobs/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        queuedCount: 3
      });
    } finally {
      await app.close();
    }
  });

  it("marks jobs as sent when provider delivery succeeds", async () => {
    mockPrisma.notificationJob.findMany.mockResolvedValue([
      {
        id: "job-1",
        attemptCount: 0,
        maxAttempts: 4,
        recipientEmail: "tenant@example.com",
        templateKey: "booking-approved",
        notification: {
          title: "Booking approved",
          message: "Your booking has been approved.",
          tenantId: "tenant-1"
        }
      }
    ]);
    mockPrisma.notificationJob.update.mockResolvedValue({});

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/notifications/drain",
        payload: { limit: 10 }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        processed: 1,
        sent: 1,
        retried: 0,
        deadLettered: 0
      });
    } finally {
      await app.close();
    }
  });

  it("moves failing jobs to retry", async () => {
    mockPrisma.notificationJob.findMany.mockResolvedValue([
      {
        id: "job-1",
        attemptCount: 0,
        maxAttempts: 4,
        recipientEmail: "tenant@example.com",
        templateKey: "booking-approved",
        notification: {
          title: "Booking approved",
          message: "Your booking has been approved.",
          tenantId: "tenant-1"
        }
      }
    ]);
    mockPrisma.notificationJob.update.mockResolvedValue({});

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/notifications/drain",
        payload: { simulateProviderFailure: true }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        processed: 1,
        sent: 0,
        retried: 1,
        deadLettered: 0
      });
    } finally {
      await app.close();
    }
  });

  it("surfaces dead-letter jobs", async () => {
    mockPrisma.notificationJob.findMany.mockResolvedValue([
      { id: "job-dead-1", status: "dead_letter" }
    ]);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/jobs/notifications/dlq"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: [{ id: "job-dead-1", status: "dead_letter" }]
      });
    } finally {
      await app.close();
    }
  });
});

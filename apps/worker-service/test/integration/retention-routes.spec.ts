import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockRunRetentionSweep, mockEraseGuest } = vi.hoisted(() => ({
  mockPrisma: {
    retentionPolicy: { findMany: vi.fn() }
  },
  mockRunRetentionSweep: vi.fn(),
  mockEraseGuest: vi.fn()
}));

vi.mock("@eventrax/database", () => ({
  prisma: mockPrisma,
  runRetentionSweep: mockRunRetentionSweep,
  eraseGuest: mockEraseGuest
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

describe("worker-service GDPR retention routes", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "worker-service";
    process.env.PORT = "3005";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    delete process.env.GDPR_RETENTION_ENABLED;
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnv();
  });

  it("no-ops the retention sweep when GDPR_RETENTION_ENABLED is not set (default off)", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/v1/jobs/compliance/retention/run" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ enabled: false, policiesRun: 0 });
      expect(mockPrisma.retentionPolicy.findMany).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("runs the sweep across active policies when enabled", async () => {
    process.env.GDPR_RETENTION_ENABLED = "true";
    mockPrisma.retentionPolicy.findMany.mockResolvedValue([
      { id: "policy-1", tenantId: null, entity: "guest", retainDays: 30, mode: "anonymise", isActive: true }
    ]);
    mockRunRetentionSweep.mockResolvedValue({ scanned: 5, processed: 3, retainedActive: 2 });

    const app = await buildApp();
    try {
      const response = await app.inject({ method: "POST", url: "/api/v1/jobs/compliance/retention/run" });
      expect(response.json()).toEqual({
        enabled: true,
        policiesRun: 1,
        scanned: 5,
        processed: 3,
        retainedActive: 2
      });
    } finally {
      await app.close();
    }
  });

  it("no-ops the erase endpoint when GDPR_RETENTION_ENABLED is off", async () => {
    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/compliance/guests/11111111-1111-1111-1111-111111111111/erase"
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ enabled: false, erased: false });
      expect(mockEraseGuest).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("erases a guest when enabled and found", async () => {
    process.env.GDPR_RETENTION_ENABLED = "true";
    mockEraseGuest.mockResolvedValue({ erased: true });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/compliance/guests/11111111-1111-1111-1111-111111111111/erase",
        payload: { requestedBy: "compliance@example.com" }
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ enabled: true, erased: true });
      expect(mockEraseGuest).toHaveBeenCalledWith(
        mockPrisma,
        "11111111-1111-1111-1111-111111111111",
        "compliance@example.com"
      );
    } finally {
      await app.close();
    }
  });

  it("returns 404 when erasing a guest that doesn't exist", async () => {
    process.env.GDPR_RETENTION_ENABLED = "true";
    mockEraseGuest.mockResolvedValue({ erased: false, reason: "not_found" });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/compliance/guests/11111111-1111-1111-1111-111111111111/erase"
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});

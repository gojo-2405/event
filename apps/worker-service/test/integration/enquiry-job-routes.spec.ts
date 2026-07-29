import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    notificationJob: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    enquiryDispatch: {
      findMany: vi.fn(),
      update: vi.fn()
    },
    enquiry: {
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

describe("worker-service enquiry job routes", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "worker-service";
    process.env.PORT = "3005";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    process.env.AOK_API_BASE_URL = "https://alpha.aokevents.com";
    process.env.AOK_ENQUIRY_SOURCE_DEFAULT = "Eventrax";
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetEnv();
  });

  it("sends queued AOK enquiry dispatches", async () => {
    mockPrisma.enquiryDispatch.findMany.mockResolvedValue([
      {
        id: "dispatch-1",
        enquiryId: "enquiry-1",
        dispatchKey: "dispatch-key-1",
        targetMode: "public",
        targetContactRef: null,
        attemptCount: 0,
        maxAttempts: 5,
        payload: {
          enquirySource: "Eventrax",
          details: "Need hospitality",
          publicContact: {
            name: "Sam",
            surname: "JP",
            email: "sam@example.com"
          }
        }
      }
    ]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 12345 })
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/enquiries/drain"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        processed: 1,
        sent: 1
      });
      expect(mockPrisma.enquiry.update).toHaveBeenCalledWith({
        where: { id: "enquiry-1" },
        data: { crmRef: "12345" }
      });
    } finally {
      await app.close();
    }
  });

  it("moves failing AOK dispatches to retry", async () => {
    mockPrisma.enquiryDispatch.findMany.mockResolvedValue([
      {
        id: "dispatch-1",
        enquiryId: "enquiry-1",
        dispatchKey: "dispatch-key-1",
        targetMode: "public",
        targetContactRef: null,
        attemptCount: 0,
        maxAttempts: 5,
        payload: {
          enquirySource: "Eventrax",
          details: "Need hospitality",
          publicContact: {
            name: "Sam",
            surname: "JP"
          }
        }
      }
    ]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/enquiries/drain"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        processed: 1,
        retried: 1
      });
    } finally {
      await app.close();
    }
  });

  it("treats a 409 duplicate AOK response as sent without a crmRef, flagged for reconciliation", async () => {
    mockPrisma.enquiryDispatch.findMany.mockResolvedValue([
      {
        id: "dispatch-1",
        enquiryId: "enquiry-1",
        dispatchKey: "enquiry-1",
        targetMode: "public",
        targetContactRef: null,
        attemptCount: 0,
        maxAttempts: 4,
        payload: {
          enquirySource: "Eventrax",
          details: "Need hospitality",
          publicContact: {
            name: "Sam",
            surname: "JP"
          }
        }
      }
    ]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({})
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/enquiries/drain"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        processed: 1,
        sent: 1
      });
      expect(mockPrisma.enquiryDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dispatch-1" },
          data: expect.objectContaining({
            status: "sent",
            crmRef: null,
            lastError: expect.stringContaining("409 duplicate")
          })
        })
      );
      expect(mockPrisma.enquiry.update).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("dead-letters an AOK dispatch on its 4th failure", async () => {
    mockPrisma.enquiryDispatch.findMany.mockResolvedValue([
      {
        id: "dispatch-1",
        enquiryId: "enquiry-1",
        dispatchKey: "enquiry-1",
        targetMode: "public",
        targetContactRef: null,
        attemptCount: 3,
        maxAttempts: 4,
        payload: {
          enquirySource: "Eventrax",
          details: "Need hospitality",
          publicContact: {
            name: "Sam",
            surname: "JP"
          }
        }
      }
    ]);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    });

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/enquiries/drain"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        processed: 1,
        deadLettered: 1
      });
      expect(mockPrisma.enquiryDispatch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "dispatch-1" },
          data: expect.objectContaining({ status: "dead_letter" })
        })
      );
    } finally {
      await app.close();
    }
  });

  it("lists dead-lettered enquiry jobs", async () => {
    mockPrisma.enquiryDispatch.findMany.mockResolvedValue([{ id: "dispatch-dead-1", status: "dead_letter" }]);

    const app = await buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/jobs/enquiries/dlq"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: [{ id: "dispatch-dead-1", status: "dead_letter" }]
      });
    } finally {
      await app.close();
    }
  });
});

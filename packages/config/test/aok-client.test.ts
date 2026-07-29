import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAokClient } from "../src/index.js";

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

describe("AOK client", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    process.env.AOK_API_BASE_URL = "https://alpha.aokevents.com";
    process.env.AOK_ENQUIRY_SOURCE_DEFAULT = "Eventrax";
  });

  afterEach(() => {
    resetEnv();
  });

  it("signs outbound requests with HMAC when AOK_HMAC_SECRET is configured", async () => {
    process.env.AOK_HMAC_SECRET = "shared-secret";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 42 })
    });

    const client = createAokClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.createPublicEnquiry({
      idempotencyKey: "enquiry-1",
      enquirySource: "Eventrax",
      name: "Sam",
      surname: "JP",
      details: "Need hospitality"
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;

    expect(headers["x-aok-signature"]).toBeDefined();
    expect(headers["x-aok-timestamp"]).toBeDefined();

    const expectedSignature = createHmac("sha256", "shared-secret")
      .update(`${headers["x-aok-timestamp"]}.${init.body}`)
      .digest("hex");
    expect(headers["x-aok-signature"]).toBe(expectedSignature);
  });

  it("does not sign requests when AOK_HMAC_SECRET is not configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 42 })
    });

    const client = createAokClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    await client.createPublicEnquiry({
      idempotencyKey: "enquiry-1",
      enquirySource: "Eventrax",
      name: "Sam",
      surname: "JP",
      details: "Need hospitality"
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;

    expect(headers["x-aok-signature"]).toBeUndefined();
    expect(headers["x-aok-timestamp"]).toBeUndefined();
  });

  it("treats a 409 response as a duplicate instead of throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({})
    });

    const client = createAokClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await client.createPublicEnquiry({
      idempotencyKey: "enquiry-1",
      enquirySource: "Eventrax",
      name: "Sam",
      surname: "JP",
      details: "Need hospitality"
    });

    expect(result).toEqual({ duplicate: true });
  });

  it("preserves an id returned alongside a 409 duplicate response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ id: 99 })
    });

    const client = createAokClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await client.createPublicEnquiry({
      idempotencyKey: "enquiry-1",
      enquirySource: "Eventrax",
      name: "Sam",
      surname: "JP",
      details: "Need hospitality"
    });

    expect(result).toEqual({ id: 99, duplicate: true });
  });

  it("still throws on other non-2xx statuses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    });

    const client = createAokClient({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(
      client.createPublicEnquiry({
        idempotencyKey: "enquiry-1",
        enquirySource: "Eventrax",
        name: "Sam",
        surname: "JP",
        details: "Need hospitality"
      })
    ).rejects.toThrow("AOK request failed with status 500");
  });

  it("fetches a booking with offers included (E20-58 status mirror)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 456,
        status: "Offered",
        offers: [{ offered: "2026-07-01T10:00:00Z", offeredBy: "Ops Team" }]
      })
    });

    const client = createAokClient({ fetchImpl: fetchMock as unknown as typeof fetch });
    const result = await client.getBooking(456);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://alpha.aokevents.com/api/v1/bookings/456?include=Offers",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual({
      id: 456,
      status: "Offered",
      offers: [{ offered: "2026-07-01T10:00:00Z", offeredBy: "Ops Team" }]
    });
  });
});

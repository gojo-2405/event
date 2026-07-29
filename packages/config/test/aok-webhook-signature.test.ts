import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isAokWebhookCategory, verifyAokWebhookSignature } from "../src/index.js";

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

const secret = "test-only-placeholder-secret-do-not-use";

function sign(body: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`v1:${timestamp}:${body}`).digest("hex");
}

describe("verifyAokWebhookSignature", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";
    process.env.AOK_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    resetEnv();
  });

  it("accepts a correctly signed, fresh request", () => {
    const body = JSON.stringify({ enquiryId: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const result = verifyAokWebhookSignature({ body, signature: sign(body, timestamp), timestamp });

    expect(result.valid).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const body = JSON.stringify({ enquiryId: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const result = verifyAokWebhookSignature({
      body,
      signature: "f".repeat(64),
      timestamp
    });

    expect(result).toEqual({ valid: false, reason: "signature_mismatch" });
  });

  it("rejects a payload that doesn't match what was signed", () => {
    const signedBody = JSON.stringify({ enquiryId: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign(signedBody, timestamp);

    const result = verifyAokWebhookSignature({
      body: JSON.stringify({ enquiryId: 2 }),
      signature,
      timestamp
    });

    expect(result.valid).toBe(false);
  });

  it("rejects a timestamp older than 5 minutes (replay protection)", () => {
    const body = JSON.stringify({ enquiryId: 1 });
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();

    const result = verifyAokWebhookSignature({
      body,
      signature: sign(body, staleTimestamp),
      timestamp: staleTimestamp
    });

    expect(result).toEqual({ valid: false, reason: "stale_timestamp" });
  });

  it("rejects when headers are missing", () => {
    const result = verifyAokWebhookSignature({
      body: "{}",
      signature: undefined,
      timestamp: undefined
    });

    expect(result).toEqual({ valid: false, reason: "missing_headers" });
  });

  it("rejects when no webhook secret is configured", () => {
    delete process.env.AOK_WEBHOOK_SECRET;
    const body = JSON.stringify({ enquiryId: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const result = verifyAokWebhookSignature({ body, signature: sign(body, timestamp), timestamp });

    expect(result).toEqual({ valid: false, reason: "missing_secret" });
  });
});

describe("isAokWebhookCategory", () => {
  it("accepts the five known categories", () => {
    for (const category of ["booking", "client", "contact", "enquiry", "organisation"]) {
      expect(isAokWebhookCategory(category)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(isAokWebhookCategory("unknown")).toBe(false);
    expect(isAokWebhookCategory(123)).toBe(false);
    expect(isAokWebhookCategory(undefined)).toBe(false);
  });
});

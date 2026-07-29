import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "dotenv";
import { z } from "zod";

let envLoaded = false;
let loadedEnv: Record<string, string> = {};

function firstDefined(source: Record<string, string | undefined>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function resolveDatabaseUrl(source: Record<string, string | undefined>): string | undefined {
  const directUrl = firstDefined(source, ["DATABASE_URL"]);
  if (directUrl) {
    return directUrl;
  }

  const databaseUrlFile = firstDefined(source, ["DATABASE_URL_FILE"]);
  if (databaseUrlFile && existsSync(databaseUrlFile)) {
    const fileContents = readFileSync(databaseUrlFile, "utf8").trim();
    if (fileContents.length > 0) {
      return fileContents;
    }
  }

  const host = firstDefined(source, ["DATABASE_HOST", "DB_HOST", "PGHOST"]);
  const port = firstDefined(source, ["DATABASE_PORT", "DB_PORT", "PGPORT"]) ?? "5432";
  const database = firstDefined(source, ["DATABASE_NAME", "DB_NAME", "PGDATABASE"]);
  const username = firstDefined(source, ["DATABASE_USER", "DB_USER", "PGUSER"]);
  const password = firstDefined(source, ["DATABASE_PASSWORD", "DB_PASSWORD", "PGPASSWORD"]);

  if (!host || !database || !username) {
    return undefined;
  }

  const query = new URLSearchParams();
  const sslMode = firstDefined(source, ["DATABASE_SSLMODE", "DB_SSLMODE", "PGSSLMODE"]);
  const schema = firstDefined(source, ["DATABASE_SCHEMA", "DB_SCHEMA"]);

  if (sslMode) {
    query.set("sslmode", sslMode);
  }

  if (schema) {
    query.set("schema", schema);
  }

  const credentials = password
    ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}`
    : encodeURIComponent(username);
  const queryString = query.toString();

  return `postgresql://${credentials}@${host}:${port}/${database}${queryString ? `?${queryString}` : ""}`;
}

function discoverEnvFiles(startDir: string): string[] {
  const discovered: string[] = [];
  let currentDir = startDir;

  while (true) {
    const envPath = path.join(currentDir, ".env");
    const envLocalPath = path.join(currentDir, ".env.local");
    const workspaceMarker = path.join(currentDir, "pnpm-workspace.yaml");

    if (existsSync(envPath)) {
      discovered.push(envPath);
    }

    if (existsSync(envLocalPath)) {
      discovered.push(envLocalPath);
    }

    if (existsSync(workspaceMarker)) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return discovered.reverse();
}

function loadEnvFiles(): void {
  if (envLoaded) {
    return;
  }

  const files = discoverEnvFiles(process.cwd());
  const discoveredEnv: Record<string, string> = {};

  for (const file of files) {
    const parsed = parse(readFileSync(file));
    Object.assign(discoveredEnv, parsed);
  }

  loadedEnv = discoveredEnv;
  envLoaded = true;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1).default("eventrax-service"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  OTEL_ENABLED: z.coerce.boolean().default(true),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_VERSION: z.string().min(1).default("0.1.0"),
  AWS_REGION: z.string().min(1).default("eu-west-1"),
  AWS_CLOUDWATCH_LOG_GROUP: z.string().min(1).default("/eventrax/services"),
  AUTH_DEBUG_BYPASS: z.coerce.boolean().default(false),
  JWT_ISSUER: z.string().min(1).default("https://eventrax.local"),
  JWT_AUDIENCE: z.string().min(1).default("eventrax-api"),
  JWT_SECRET: z.string().min(1).default("change-me"),
  EVENT_SERVICE_BASE_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SERVICE_BASE_URL: z.string().url().default("http://localhost:3001"),
  BOOKING_SERVICE_BASE_URL: z.string().url().default("http://localhost:3003"),
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_REDIRECT_URI: z.string().url().optional(),
  AOK_API_BASE_URL: z.string().url().default("https://alpha.aokevents.com"),
  AOK_API_KEY: z.string().optional(),
  AOK_HMAC_SECRET: z.string().min(1).optional(),
  // Separate from AOK_HMAC_SECRET: this signs/verifies AOK's *inbound webhooks* to us,
  // a different credential and a different (documented) scheme than our outbound calls to AOK.
  AOK_WEBHOOK_SECRET: z.string().min(1).optional(),
  AOK_ENQUIRY_SOURCE_DEFAULT: z.string().min(1).default("Eventrax"),
  AOK_ENQUIRY_DRAIN_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(15),
  AOK_INTEGRATION_DRAIN_INTERVAL_SECONDS: z.coerce.number().int().min(0).default(15),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().min(1).optional(),
  // ISO 4217 default applied to an enquiry's budget/taxAmount when the submitter (the
  // eventrax-2.0 wizard) doesn't send one explicitly.
  ENQUIRY_DEFAULT_CURRENCY: z.string().min(1).default("GBP"),
  // E20-59: ticket explicitly requires "Client legal/compliance sign-off required before
  // enabling in production." Defaults to false so the mechanism can be built, tested, and
  // deployed inert — every retention/erasure endpoint checks this before doing anything.
  GDPR_RETENTION_ENABLED: z.coerce.boolean().default(false)
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadConfig(source: Record<string, string | undefined> = process.env): AppEnv {
  loadEnvFiles();
  const merged = {
    ...loadedEnv,
    ...process.env,
    ...source
  };

  if (merged.DATABASE_URL === undefined) {
    const resolvedDatabaseUrl = resolveDatabaseUrl(merged);
    if (resolvedDatabaseUrl) {
      merged.DATABASE_URL = resolvedDatabaseUrl;
    }
  }

  return envSchema.parse(merged);
}

interface AokClientDependencies {
  fetchImpl?: typeof fetch;
}

export interface CreateAokPublicEnquiryInput {
  idempotencyKey: string;
  enquirySource: string;
  name: string;
  surname: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  position?: string;
  additionalInformation?: string;
  details: string;
}

export interface CreateAokContactEnquiryInput {
  contactId: number;
  idempotencyKey: string;
  enquirySource: string;
  details: string;
}

export interface AokEnquiryResponse {
  id?: number;
  duplicate?: boolean;
}

export interface AokEnquiryDetails {
  id: number;
  enquirySource: string;
  contactId: number;
  bookingId?: number;
  details: string;
  created?: string;
  dealtWith?: string;
}

export interface AokEnquiryWebhookPayload {
  action?: "Ignored" | "BookingSpawned";
  enquiryId?: number;
  bookingId?: number;
}

// Per AOK's real OpenAPI spec (aok-api.json), this is the full set of Booking.status values —
// there is no separate "proposals_sent"/"proposal_accepted"/"rejected" webhook or status.
// AOK never pushes booking status changes; GET /api/v1/bookings/{bookingId} must be polled.
export type AokBookingStatus =
  | "InNegotiation"
  | "Offered"
  | "Accepted"
  | "Unreviewed"
  | "Completed"
  | "Cancelled";

export interface AokBookingOffer {
  offered: string;
  reoffered?: string;
  response?: string;
  accepted?: boolean;
  offeredBy: string;
  responseBy?: string;
}

export interface AokBookingDetails {
  id: number;
  status: AokBookingStatus;
  offers?: AokBookingOffer[];
}

export const AOK_WEBHOOK_CATEGORIES = [
  "booking",
  "client",
  "contact",
  "enquiry",
  "organisation"
] as const;

export type AokWebhookCategory = (typeof AOK_WEBHOOK_CATEGORIES)[number];

export function isAokWebhookCategory(value: unknown): value is AokWebhookCategory {
  return (
    typeof value === "string" && (AOK_WEBHOOK_CATEGORIES as readonly string[]).includes(value)
  );
}

const AOK_WEBHOOK_REPLAY_WINDOW_SECONDS = 5 * 60;

export interface VerifyAokWebhookSignatureInput {
  body: string;
  signature: string | undefined;
  timestamp: string | undefined;
  now?: Date;
}

export interface VerifyAokWebhookSignatureResult {
  valid: boolean;
  reason?: "missing_secret" | "missing_headers" | "invalid_timestamp" | "stale_timestamp" | "signature_mismatch";
}

/**
 * Verifies AOK's inbound webhook signature per their documented scheme:
 * HMAC-SHA256 over "v1:{timestamp}:{payload}" using the shared secret shown on
 * AOK's webhook config screen, sent as the X-API-Signature / X-API-Timestamp headers.
 * Distinct from the outbound signing in createAokClient (different secret, different scheme).
 */
export function verifyAokWebhookSignature(
  input: VerifyAokWebhookSignatureInput
): VerifyAokWebhookSignatureResult {
  const config = loadConfig();

  if (!config.AOK_WEBHOOK_SECRET) {
    return { valid: false, reason: "missing_secret" };
  }

  if (!input.signature || !input.timestamp) {
    return { valid: false, reason: "missing_headers" };
  }

  const timestampSeconds = Number(input.timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return { valid: false, reason: "invalid_timestamp" };
  }

  const now = input.now ?? new Date();
  const ageSeconds = Math.abs(now.getTime() / 1000 - timestampSeconds);
  if (ageSeconds > AOK_WEBHOOK_REPLAY_WINDOW_SECONDS) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const expectedSignature = createHmac("sha256", config.AOK_WEBHOOK_SECRET)
    .update(`v1:${input.timestamp}:${input.body}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const actualBuffer = Buffer.from(input.signature, "hex");

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return { valid: false, reason: "signature_mismatch" };
  }

  return { valid: true };
}

function signAokRequestBody(body: string): { signature: string; timestamp: string } | null {
  const config = loadConfig();

  if (!config.AOK_HMAC_SECRET) {
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", config.AOK_HMAC_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  return { signature, timestamp };
}

function createAokHeaders(body: string): HeadersInit {
  const config = loadConfig();
  const signed = signAokRequestBody(body);

  return {
    accept: "application/json",
    "content-type": "application/json",
    ...(config.AOK_API_KEY ? { "x-api-key": config.AOK_API_KEY } : {}),
    ...(signed
      ? { "x-aok-signature": signed.signature, "x-aok-timestamp": signed.timestamp }
      : {})
  };
}

// No generic constraint here on purpose: AokEnquiryResponse already declares
// `duplicate?: boolean` as a real property (used by createPublicEnquiry/createContactEnquiry),
// but AokEnquiryDetails (used by getEnquiry) doesn't and shouldn't need to. Constraining
// T to `{ duplicate?: boolean }` broke getEnquiry's call with a TS2559 "no properties in
// common" weak-type error, since AokEnquiryDetails shares no property names with that
// constraint at all — caught by `pnpm test`'s real tsc build, not by this environment's
// verification workaround, which only stripped types rather than checking them.
async function parseAokJsonResponse<T>(response: Response): Promise<T> {
  if (response.status === 409) {
    const body = await response.json().catch(() => ({}));
    return { ...(body as object), duplicate: true } as T;
  }

  if (!response.ok) {
    throw new Error(`AOK request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function createAokClient(dependencies: AokClientDependencies = {}) {
  const config = loadConfig();
  const fetchImpl = dependencies.fetchImpl ?? fetch;

  return {
    async createPublicEnquiry(input: CreateAokPublicEnquiryInput): Promise<AokEnquiryResponse> {
      const body = JSON.stringify(input);
      const response = await fetchImpl(`${config.AOK_API_BASE_URL}/api/v1/enquiries`, {
        method: "POST",
        headers: createAokHeaders(body),
        body
      });

      return parseAokJsonResponse<AokEnquiryResponse>(response);
    },

    async createContactEnquiry(input: CreateAokContactEnquiryInput): Promise<AokEnquiryResponse> {
      const body = JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        enquirySource: input.enquirySource,
        details: input.details
      });
      const response = await fetchImpl(
        `${config.AOK_API_BASE_URL}/api/v1/contacts/${input.contactId}/enquiries`,
        {
          method: "POST",
          headers: createAokHeaders(body),
          body
        }
      );

      return parseAokJsonResponse<AokEnquiryResponse>(response);
    },

    async getEnquiry(enquiryId: number): Promise<AokEnquiryDetails> {
      const response = await fetchImpl(`${config.AOK_API_BASE_URL}/api/v1/enquiries/${enquiryId}`, {
        method: "GET",
        headers: createAokHeaders("")
      });

      return parseAokJsonResponse<AokEnquiryDetails>(response);
    },

    // E20-58: AOK has no webhook for booking status/offer changes, so the status-mirror
    // poll fetches this directly. `include=Offers` per AOK's spec (Bookings_Get).
    async getBooking(bookingId: number): Promise<AokBookingDetails> {
      const response = await fetchImpl(
        `${config.AOK_API_BASE_URL}/api/v1/bookings/${bookingId}?include=Offers`,
        {
          method: "GET",
          headers: createAokHeaders("")
        }
      );

      return parseAokJsonResponse<AokBookingDetails>(response);
    }
  };
}

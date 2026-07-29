import { createHmac, timingSafeEqual } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { loadConfig } from "@eventrax/config";
import { sessionClaimsSchema, type SessionClaims } from "@eventrax/contracts";
import { createLogger } from "@eventrax/logger";

const SESSION_COOKIE = "etx_session";

function readSessionCookie(headers: Record<string, unknown>): string | null {
  const header = headers["cookie"];
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx !== -1 && part.slice(0, idx).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function base64UrlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// Verify an HS256 JWT with Node's crypto (no extra dependency). Checks signature, exp, iss, aud.
function verifyHs256(token: string, secret: string, issuer: string, audience: string): unknown | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest();
  const actual = base64UrlToBuffer(signature!);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  let claims: any;
  try {
    claims = JSON.parse(base64UrlToBuffer(payload!).toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && now >= claims.exp) return null;
  if (claims.iss !== issuer || claims.aud !== audience) return null;
  return claims;
}

// Verify the session cookie JWT so the gateway can enforce auth and inject trusted identity
// headers for the downstream services (which read x-etx-* via getTrustedIdentity).
function verifySessionCookie(
  headers: Record<string, unknown>,
  config: ReturnType<typeof loadConfig>
): SessionClaims | null {
  const token = readSessionCookie(headers);
  if (!token) return null;
  const claims = verifyHs256(token, config.JWT_SECRET, config.JWT_ISSUER, config.JWT_AUDIENCE);
  if (!claims) return null;
  const parsed = sessionClaimsSchema.safeParse(claims);
  return parsed.success ? parsed.data : null;
}

function buildForwardHeaders(request: any, auth: SessionClaims | null): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.headers ?? {})) {
    if (typeof value === "string" && key.toLowerCase() !== "host" && key.toLowerCase() !== "content-length") {
      headers[key] = value;
    }
  }

  if (auth) {
    headers["x-etx-user-id"] = auth.sub;
    headers["x-etx-tenant-id"] = auth.tenantId;
    headers["x-etx-role"] = auth.role;
    if (auth.email) {
      headers["x-etx-email"] = auth.email;
    }
  }

  return headers;
}

async function forwardRequest(params: {
  app: any;
  config: ReturnType<typeof loadConfig>;
  request: any;
  reply: any;
  targetBaseUrl: string;
  requireSession: boolean;
}): Promise<void> {
  // For everything except the auth endpoints themselves, require a valid session cookie and
  // inject the trusted identity headers the downstream services consume.
  let auth: SessionClaims | null = null;
  if (params.requireSession) {
    auth = verifySessionCookie(params.request.headers, params.config);
    if (!auth) {
      return params.reply.unauthorized("Authentication required");
    }
  }

  const upstreamUrl = new URL(params.request.raw.url, params.targetBaseUrl);
  const headers = buildForwardHeaders(params.request, auth);
  const hasBody = params.request.method !== "GET" && params.request.method !== "HEAD";
  const response = await fetch(upstreamUrl, {
    method: params.request.method,
    headers,
    body: hasBody ? JSON.stringify(params.request.body ?? {}) : undefined
  });

  params.reply.code(response.status);
  // Relay Set-Cookie explicitly (login/logout) — getSetCookie() preserves each cookie separately,
  // which Headers.forEach would otherwise fold together.
  const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    params.reply.header("set-cookie", setCookies);
  }
  response.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "content-length" || k === "set-cookie") {
      return;
    }
    params.reply.header(key, value);
  });

  const text = await response.text();
  params.reply.send(text.length > 0 ? text : undefined);
}

function registerProxyRoutes(params: {
  app: FastifyInstance;
  config: ReturnType<typeof loadConfig>;
  routes: string[];
  targetBaseUrl: string;
  requireSession: boolean;
  // HTTP methods the gateway forwards for these routes. Defaults to read/create; pass a wider set
  // for groups that also expose update/delete (e.g. event-service: PATCH edit, DELETE draft).
  methods?: ("GET" | "POST" | "PATCH" | "DELETE")[];
}): void {
  const methods = params.methods ?? ["GET", "POST"];
  for (const route of params.routes) {
    params.app.options(route, async (_request, reply) => {
      reply.code(204).send();
    });

    params.app.route({
      method: methods,
      url: route,
      handler: async (request, reply) =>
        forwardRequest({
          app: params.app,
          config: params.config,
          request,
          reply,
          targetBaseUrl: params.targetBaseUrl,
          requireSession: params.requireSession
        })
    });
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "api-gateway"
  });
  const logger = createLogger();
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger });

  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true
  });
  await app.register(sensible);

  app.get("/api/v1/api-gateway/health", async () => ({
    ok: true as const,
    service: config.SERVICE_NAME,
    version: config.OTEL_SERVICE_VERSION
  }));

  // Auth endpoints -> auth-service. These establish/verify the session, so they must NOT require
  // a session themselves (login/logout are public; me verifies its own cookie).
  registerProxyRoutes({
    app,
    config,
    routes: [
    "/api/v1/auth/login",
    "/api/v1/auth/logout",
    "/api/v1/auth/me"
    ],
    targetBaseUrl: config.AUTH_SERVICE_BASE_URL,
    requireSession: false
  });

  // Event-service routes — require a valid session; the gateway injects trusted identity headers.
  registerProxyRoutes({
    app,
    config,
    routes: [
    "/api/v1/events",
    "/api/v1/events/:id",
    "/api/v1/events/:id/audit",
    "/api/v1/events/:id/publish",
    "/api/v1/events/:id/unpublish",
    "/api/v1/events/:id/visibility/groups",
    // FRD Epic 3: Requester booking -> CEM approval -> Guest List.
    "/api/v1/events/:id/bookings",
    "/api/v1/events/:id/bookings/:bookingId/approve",
    "/api/v1/events/:id/bookings/:bookingId/reject",
    "/api/v1/requestor-groups"
    ],
    targetBaseUrl: config.EVENT_SERVICE_BASE_URL,
    requireSession: true,
    // Event-service also serves PATCH (edit a Listing) and DELETE (remove a draft), so the
    // gateway must forward those verbs for these routes, not just GET/POST.
    methods: ["GET", "POST", "PATCH", "DELETE"]
  });

  // Booking-service enquiry routes — also require a valid session; keeps the frontend talking
  // only to the gateway in deployed environments instead of exposing service-specific hosts.
  registerProxyRoutes({
    app,
    config,
    routes: [
    "/api/v1/enquiries",
    "/api/v1/enquiries/:id/cancel",
    "/api/v1/enquiries/dispatch",
    "/api/v1/enquiries/:id/dispatches"
    ],
    targetBaseUrl: config.BOOKING_SERVICE_BASE_URL,
    requireSession: true
  });

  return app;
}

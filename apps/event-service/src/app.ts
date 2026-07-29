import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { loadConfig } from "@eventrax/config";
import { createLogger } from "@eventrax/logger";
import { registerEventRoutes } from "./modules/events/presentation/http/event-routes.js";
import { registerPublishingRoutes } from "./modules/events/presentation/http/publishing-routes.js";
import { registerBookingRoutes } from "./modules/events/presentation/http/booking-routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "event-service"
  });
  const logger = createLogger();
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger });

  // Without this, the browser blocks cross-origin calls from the eventrax-2.0 dev server
  // (localhost:8080) to this service (localhost:3000) outright — the fetch throws before a
  // response is ever read, which CreateEventDialog's catch block quietly treats as "couldn't
  // reach the server" and falls back to localStorage-only. Only api-gateway had this
  // registered before, but nothing actually routes through api-gateway yet — the frontend
  // talks to each service directly (see VITE_API_BASE_URL).
  await app.register(cors, { origin: true });
  await app.register(sensible);

  app.get("/api/v1/event-service/health", async () => ({
    ok: true as const,
    service: config.SERVICE_NAME,
    version: config.OTEL_SERVICE_VERSION
  }));

  // Was a bare-bones inline stub (`app.get("/v1/events", ...)`, no filters, no /api/v1 prefix,
  // unrelated to the versioned route convention every other endpoint in this repo follows).
  // Superseded by the real `GET /api/v1/events` in registerEventRoutes (S2-02 Listing CRUD).
  await registerEventRoutes(app);
  // FRD JIRA Epic 2: Publishing & Visibility Targeting (Requestor Groups, publish/unpublish,
  // force-publish, visibility expansion).
  await registerPublishingRoutes(app);
  // FRD JIRA Epic 3: Requester booking -> CEM approval -> Guest List. Pending bookings surface
  // in the Requests tab; approval confirms them (reserves a seat, counts toward utilisation).
  await registerBookingRoutes(app);

  return app;
}

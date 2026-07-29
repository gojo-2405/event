import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { loadConfig } from "@eventrax/config";
import { prisma } from "@eventrax/database";
import { createLogger } from "@eventrax/logger";

import { registerInvitationRoutes } from "./modules/invitations/presentation/http/invitation-routes.js";
import { registerNotificationRoutes } from "./modules/notifications/presentation/http/notification-routes.js";
import { registerEnquiryRoutes } from "./modules/enquiries/presentation/http/enquiry-routes.js";
import { registerIntegrationWebhookRoutes } from "./modules/integration/presentation/http/webhook-routes.js";

export async function buildApp(): Promise<any> {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "booking-service"
  });
  const logger = createLogger();
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger });

  // Same fix as event-service: without this, the browser blocks eventrax-2.0's cross-origin
  // requests (localhost:8080 -> this service) before a response is ever read, which every
  // caller's catch block silently treats as "server unreachable" and falls back to
  // local-only state. credentials:true (with origin reflected, not "*") is required because the
  // frontend now sends the session cookie on every request (credentials:"include").
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  app.get("/api/v1/booking-service/health", async () => ({
    ok: true as const,
    service: config.SERVICE_NAME,
    version: config.OTEL_SERVICE_VERSION
  }));

  await registerEnquiryRoutes(app);
  await registerInvitationRoutes(app);
  await registerNotificationRoutes(app);
  await registerIntegrationWebhookRoutes(app);

  app.get("/v1/bookings", async () => {
    return prisma.booking.findMany({
      take: 25,
      orderBy: { createdAt: "desc" }
    });
  });

  return app;
}

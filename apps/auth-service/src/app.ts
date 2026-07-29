import sensible from "@fastify/sensible";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import { loadConfig } from "@eventrax/config";
import { prisma } from "@eventrax/database";
import { createLogger } from "@eventrax/logger";

import { authPlugin } from "./bootstrap/plugins/auth.js";
import { registerAuthRoutes } from "./modules/identity/presentation/http/auth-routes.js";
import { requirePermission } from "./shared/helpers/require-permission.js";
import { buildUserReadScope } from "./shared/helpers/tenant-scope.js";

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "auth-service"
  });
  const logger = createLogger();
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger });

  await app.register(sensible);
  await app.register(authPlugin);

  app.get("/api/v1/auth-service/health", async () => ({
    ok: true as const,
    service: config.SERVICE_NAME,
    version: config.OTEL_SERVICE_VERSION
  }));
  await registerAuthRoutes(app);

  app.get("/api/v1/users", async (request, reply) => {
    requirePermission(request, reply, "users.read");

    return prisma.appUser.findMany({
      where: buildUserReadScope(request.auth),
      take: 25,
      orderBy: { createdAt: "desc" }
    });
  });

  return app;
}

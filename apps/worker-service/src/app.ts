import sensible from "@fastify/sensible";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { loadConfig } from "@eventrax/config";
import { prisma } from "@eventrax/database";
import { createLogger } from "@eventrax/logger";
import { drainEnquiryJobs } from "./modules/enquiries/application/drain-enquiry-jobs.js";
import { drainInboundEvents } from "./modules/integration/application/drain-inbound-events.js";
import { registerNotificationJobRoutes } from "./modules/notifications/presentation/http/notification-job-routes.js";
import { registerIntegrationJobRoutes } from "./modules/integration/presentation/http/integration-job-routes.js";
import { registerEnquiryStatusMirrorRoutes } from "./modules/integration/presentation/http/enquiry-status-mirror-routes.js";
import { registerRetentionRoutes } from "./modules/compliance/presentation/http/retention-routes.js";

export async function buildApp(): Promise<any> {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "worker-service"
  });
  const logger = createLogger();
  const app = Fastify({ loggerInstance: logger as FastifyBaseLogger });

  await app.register(sensible);

  app.get("/api/v1/worker-service/health", async () => ({
    ok: true as const,
    service: config.SERVICE_NAME,
    version: config.OTEL_SERVICE_VERSION
  }));

  await registerNotificationJobRoutes(app, config);
  await registerIntegrationJobRoutes(app);
  await registerEnquiryStatusMirrorRoutes(app);
  await registerRetentionRoutes(app);

  const drainLimitDefault = 10;
  let enquiryDrainInFlight = false;
  const runEnquiryDrain = async (limit?: number) => {
    if (enquiryDrainInFlight) {
      return {
        processed: 0,
        sent: 0,
        retried: 0,
        deadLettered: 0,
        skipped: true as const
      };
    }

    enquiryDrainInFlight = true;
    try {
      return await drainEnquiryJobs({ logger: app.log, limit: limit ?? drainLimitDefault });
    } finally {
      enquiryDrainInFlight = false;
    }
  };

  const intervalSeconds = config.AOK_ENQUIRY_DRAIN_INTERVAL_SECONDS;
  const enquiryDrainTimer =
    intervalSeconds > 0
      ? setInterval(() => {
          void runEnquiryDrain().catch((error) => {
            app.log.error(
              { err: error },
              "Automatic AOK enquiry drain failed"
            );
          });
        }, intervalSeconds * 1000)
      : null;
  enquiryDrainTimer?.unref();

  const integrationDrainLimitDefault = 10;
  let integrationDrainInFlight = false;
  const runIntegrationDrain = async (limit?: number) => {
    if (integrationDrainInFlight) {
      return {
        processed: 0,
        handled: 0,
        parked: 0,
        retried: 0,
        deadLettered: 0,
        skipped: true as const
      };
    }

    integrationDrainInFlight = true;
    try {
      return await drainInboundEvents({ logger: app.log, limit: limit ?? integrationDrainLimitDefault });
    } finally {
      integrationDrainInFlight = false;
    }
  };

  const integrationIntervalSeconds = config.AOK_INTEGRATION_DRAIN_INTERVAL_SECONDS;
  const integrationDrainTimer =
    integrationIntervalSeconds > 0
      ? setInterval(() => {
          void runIntegrationDrain().catch((error) => {
            app.log.error(
              { err: error },
              "Automatic AOK inbound-event drain failed"
            );
          });
        }, integrationIntervalSeconds * 1000)
      : null;
  integrationDrainTimer?.unref();

  app.addHook("onClose", async () => {
    if (enquiryDrainTimer) {
      clearInterval(enquiryDrainTimer);
    }
    if (integrationDrainTimer) {
      clearInterval(integrationDrainTimer);
    }
  });

  app.post("/api/v1/jobs/enquiries/drain", async (request: any) => {
    const limit =
      typeof request.body?.limit === "number" && request.body.limit > 0 ? request.body.limit : 10;
    return runEnquiryDrain(limit);
  });

  app.get("/api/v1/jobs/enquiries/dlq", async () => {
    return {
      data: await prisma.enquiryDispatch.findMany({
        where: { provider: "aok", status: "dead_letter" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 50
      })
    };
  });

  app.get("/api/v1/jobs/health", async () => {
    const queuedCount = await prisma.notificationJob.count({
      where: {
        status: { in: ["queued", "retrying"] }
      }
    });

    return {
      queueLagSeconds: 0,
      queuedCount,
      consumers: ["booking-events", "notifications"]
    };
  });

  return app;
}

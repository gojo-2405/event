import { prisma } from "@eventrax/database";

import { drainInboundEvents } from "../../application/drain-inbound-events.js";

export async function registerIntegrationJobRoutes(app: any): Promise<void> {
  app.post("/api/v1/jobs/integration/drain", async (request: any) => {
    const limit =
      typeof request.body?.limit === "number" && request.body.limit > 0 ? request.body.limit : 10;
    return drainInboundEvents({ logger: app.log, limit });
  });

  app.get("/api/v1/jobs/integration/dlq", async () => {
    return {
      data: await prisma.crmInboundEvent.findMany({
        where: { status: "dead_letter" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 50
      })
    };
  });

  // Nightly-reconciliation AC: dead-lettered events don't have a confirmed "authoritative
  // state" source for categories we don't process yet (see plan doc) — this requeues them
  // for another drain pass, which is a safe, honest baseline rather than pretending to
  // re-fetch state we have no confirmed way to fetch for booking/client/contact/organisation.
  app.post("/api/v1/jobs/integration/reconcile", async (request: any) => {
    const limit =
      typeof request.body?.limit === "number" && request.body.limit > 0 ? request.body.limit : 10;

    const deadLettered = await prisma.crmInboundEvent.findMany({
      where: { status: "dead_letter" },
      orderBy: { updatedAt: "asc" },
      take: limit
    });

    let requeued = 0;
    for (const event of deadLettered) {
      await prisma.crmInboundEvent.update({
        where: { id: event.id },
        data: {
          status: "retrying",
          attemptCount: 0,
          nextAttemptAt: new Date(),
          lastError: "requeued by nightly reconciliation"
        }
      });
      requeued += 1;
    }

    return { requeued };
  });
}

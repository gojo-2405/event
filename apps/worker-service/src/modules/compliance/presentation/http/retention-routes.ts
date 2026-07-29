import { loadConfig } from "@eventrax/config";
import { eraseGuest, prisma, runRetentionSweep } from "@eventrax/database";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

/**
 * E20-59: GDPR Data Retention + Purge. Every route here checks GDPR_RETENTION_ENABLED first
 * and no-ops (200, not an error) when it's off — per the ticket's explicit note that this
 * needs client legal/compliance sign-off before running in production. Built fully, shipped
 * inert by default.
 *
 * "Nightly Worker" here means an HTTP endpoint something external calls, same posture as
 * E20-53's /jobs/integration/reconcile — there is no real cron/scheduler anywhere in this
 * repo to hang an actual schedule off of.
 */
export async function registerRetentionRoutes(app: any): Promise<void> {
  app.post("/api/v1/jobs/compliance/retention/run", async () => {
    const config = loadConfig();
    if (!config.GDPR_RETENTION_ENABLED) {
      return { enabled: false, policiesRun: 0 };
    }

    const policies = await prisma.retentionPolicy.findMany({ where: { isActive: true } });

    let scanned = 0;
    let processed = 0;
    let retainedActive = 0;

    for (const policy of policies) {
      const result = await runRetentionSweep(prisma, policy as any);
      scanned += result.scanned;
      processed += result.processed;
      retainedActive += result.retainedActive;
    }

    return {
      enabled: true,
      policiesRun: policies.length,
      scanned,
      processed,
      retainedActive
    };
  });

  app.post("/api/v1/compliance/guests/:id/erase", async (request: any, reply: any) => {
    const config = loadConfig();
    if (!config.GDPR_RETENTION_ENABLED) {
      return reply.code(200).send({ enabled: false, erased: false });
    }

    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Guest id must be a UUID");
    }

    const actor =
      typeof request.body?.requestedBy === "string" && request.body.requestedBy.length > 0
        ? request.body.requestedBy
        : "compliance:manual-erasure-request";

    const result = await eraseGuest(prisma, id, actor);
    if (!result.erased) {
      return reply.notFound("Guest not found");
    }

    return { enabled: true, erased: true };
  });
}

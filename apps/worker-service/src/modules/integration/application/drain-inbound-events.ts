import type { FastifyBaseLogger } from "fastify";

import { AOK_WEBHOOK_CATEGORIES, type AokWebhookCategory, prisma, routeInboundFlow } from "@eventrax/database";

import { resolveInboundEventRetryState } from "./inbound-event-drain.js";

function isKnownCategory(value: string): value is AokWebhookCategory {
  return (AOK_WEBHOOK_CATEGORIES as readonly string[]).includes(value);
}

export async function drainInboundEvents(options: {
  logger: FastifyBaseLogger;
  limit?: number;
}) {
  const limit = options.limit && options.limit > 0 ? options.limit : 10;
  const now = new Date();

  const events = await prisma.crmInboundEvent.findMany({
    where: {
      status: { in: ["received", "retrying"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit
  });

  let handled = 0;
  let parked = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const event of events) {
    try {
      const flow = event.flow;
      if (!isKnownCategory(flow)) {
        throw new Error(`Unrecognized inbound webhook category: ${flow}`);
      }

      const payload = (event.rawPayload as { body?: unknown } | null)?.body ?? null;
      const outcome = await routeInboundFlow(prisma, flow, payload);

      await prisma.crmInboundEvent.update({
        where: { id: event.id },
        data: {
          status: "processed",
          attemptCount: event.attemptCount + 1,
          processedAt: new Date(),
          lastError: outcome.status === "parked" ? (outcome.note ?? "parked") : null
        }
      });

      options.logger.info(
        {
          audit: true,
          actor: "worker:integration-drain",
          action: "crm_inbound_event.processed",
          inboundEventId: event.id,
          flow,
          outcome: outcome.status
        },
        "AOK inbound event processed"
      );

      handled += 1;
      if (outcome.status === "parked") {
        parked += 1;
      }
    } catch (error) {
      const retryState = resolveInboundEventRetryState({
        attemptCount: event.attemptCount,
        maxAttempts: event.maxAttempts,
        now
      });

      await prisma.crmInboundEvent.update({
        where: { id: event.id },
        data: {
          status: retryState.status,
          attemptCount: event.attemptCount + 1,
          nextAttemptAt: retryState.nextAttemptAt,
          lastError: error instanceof Error ? error.message : "Unknown inbound event processing failure"
        }
      });

      if (retryState.status === "dead_letter") {
        deadLettered += 1;
      } else {
        retried += 1;
      }
    }
  }

  return {
    processed: events.length,
    handled,
    parked,
    retried,
    deadLettered
  };
}

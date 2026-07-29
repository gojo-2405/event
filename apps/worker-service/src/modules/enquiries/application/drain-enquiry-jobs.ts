import type { FastifyBaseLogger } from "fastify";

import { prisma } from "@eventrax/database";

import { dispatchEnquiryToAok, resolveEnquiryRetryState } from "./aok-enquiry-dispatch.js";

export async function drainEnquiryJobs(options: {
  logger: FastifyBaseLogger;
  limit?: number;
}) {
  const limit = options.limit && options.limit > 0 ? options.limit : 10;
  const now = new Date();

  const jobs = await prisma.enquiryDispatch.findMany({
    where: {
      provider: "aok",
      status: { in: ["queued", "retrying"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit
  });

  let sent = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const job of jobs) {
    try {
      const response = await dispatchEnquiryToAok(job as any);
      const crmRef = response.id !== undefined ? String(response.id) : null;

      await prisma.enquiryDispatch.update({
        where: { id: job.id },
        data: {
          status: "sent",
          attemptCount: job.attemptCount + 1,
          crmRef,
          responsePayload: {
            id: response.id ?? null,
            duplicate: response.duplicate ?? false
          },
          processedAt: new Date(),
          ...(response.duplicate && crmRef === null
            ? {
                lastError:
                  "AOK reported 409 duplicate without an id — needs manual crmRef reconciliation"
              }
            : {})
        }
      });

      if (crmRef !== null) {
        await prisma.enquiry.update({
          where: { id: job.enquiryId },
          data: { crmRef }
        });

        options.logger.info(
          {
            audit: true,
            actor: "worker:aok-enquiry-dispatch",
            action: "enquiry.crm_ref.assigned",
            enquiryId: job.enquiryId,
            dispatchId: job.id,
            crmRef,
            duplicate: response.duplicate ?? false
          },
          "AOK enquiry dispatch audit"
        );
      }

      sent += 1;
    } catch (error) {
      const retryState = resolveEnquiryRetryState({
        attemptCount: job.attemptCount,
        maxAttempts: job.maxAttempts,
        now
      });

      await prisma.enquiryDispatch.update({
        where: { id: job.id },
        data: {
          status: retryState.status,
          attemptCount: job.attemptCount + 1,
          nextAttemptAt: retryState.nextAttemptAt,
          lastError: error instanceof Error ? error.message : "Unknown AOK dispatch failure"
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
    processed: jobs.length,
    sent,
    retried,
    deadLettered
  };
}

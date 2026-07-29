import {
  MockNotificationEmailProvider,
  SmtpNotificationEmailProvider,
  renderNotificationEmail,
  resolveRetryState,
  resolveSmtpProviderConfig
} from "../../application/notification-email-dispatch.js";
import { prisma } from "@eventrax/database";

export async function registerNotificationJobRoutes(
  app: any,
  config?: {
    SMTP_HOST?: string;
    SMTP_PORT?: number;
    SMTP_SECURE?: boolean;
    SMTP_USER?: string;
    SMTP_PASSWORD?: string;
    SMTP_FROM_EMAIL?: string;
    SMTP_FROM_NAME?: string;
  }
): Promise<void> {
  app.post("/api/v1/jobs/notifications/drain", async (request: any) => {
    const limit =
      typeof request.body?.limit === "number" && request.body.limit > 0 ? request.body.limit : 10;
    const simulateProviderFailure = request.body?.simulateProviderFailure === true;
    const smtpConfig = resolveSmtpProviderConfig(config ?? {});
    const provider =
      smtpConfig && !simulateProviderFailure
        ? new SmtpNotificationEmailProvider(smtpConfig)
        : new MockNotificationEmailProvider(simulateProviderFailure);
    const now = new Date();

    const jobs = await prisma.notificationJob.findMany({
      where: {
        status: { in: ["queued", "retrying"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
      },
      include: {
        notification: {
          select: {
            title: true,
            message: true,
            tenantId: true
          }
        }
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: limit
    });

    let sent = 0;
    let retried = 0;
    let deadLettered = 0;

    for (const job of jobs) {
      await prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "processing"
        }
      });

      try {
        const rendered = renderNotificationEmail({
          title: job.notification.title,
          message: job.notification.message,
          templateKey: job.templateKey
        });

        await provider.send({
          from: smtpConfig
            ? smtpConfig.fromName
              ? `"${smtpConfig.fromName.replace(/"/g, '\\"')}" <${smtpConfig.fromEmail}>`
              : smtpConfig.fromEmail
            : undefined,
          to: job.recipientEmail ?? "unknown@example.com",
          ...rendered
        });

        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: "sent",
            attemptCount: job.attemptCount + 1,
            sentAt: new Date(),
            lastError: null
          }
        });
        sent += 1;
      } catch (error) {
        const retryState = resolveRetryState({
          attemptCount: job.attemptCount,
          maxAttempts: job.maxAttempts,
          now
        });

        await prisma.notificationJob.update({
          where: { id: job.id },
          data: {
            status: retryState.status,
            attemptCount: job.attemptCount + 1,
            nextAttemptAt: retryState.nextAttemptAt,
            lastError: error instanceof Error ? error.message : "Unknown notification failure"
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
  });

  app.get("/api/v1/jobs/notifications/dlq", async () => {
    return {
      data: await prisma.notificationJob.findMany({
        where: { status: "dead_letter" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 50
      })
    };
  });
}

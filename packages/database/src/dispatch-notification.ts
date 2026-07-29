import { randomUUID } from "node:crypto";

// Reusable DI'd version of the transaction booking-service's own
// POST /api/v1/notifications/dispatch endpoint runs inline (E20-21). Extracted here rather
// than imported cross-app (apps can't import each other's code in this monorepo) because
// E20-55's listing-update cascade in event-service needs the exact same idempotent
// create-or-skip behavior. Left the original inline version in booking-service untouched to
// avoid any risk to already-tested code — this is intentional duplication-by-extraction, not
// a refactor of working code.
export interface NotificationDispatchClient {
  notification: {
    create(args: unknown): Promise<{ id: string }>;
  };
  notificationJob: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  appUser: {
    findUnique(args: unknown): Promise<{ email: string | null } | null>;
  };
}

export interface DispatchNotificationInput {
  tenantId: string;
  // Either userId (resolved to an AppUser's email) or an explicit email (for recipients with
  // no AppUser account, e.g. external Guests — Notification.userId is nullable for exactly
  // this reason) must be provided.
  userId?: string | null;
  email?: string | null;
  type: string;
  title: string;
  message: string;
  templateKey: string;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
}

export interface DispatchNotificationResult {
  dispatched: boolean;
  reason?: "duplicate" | "no_recipient_email";
  notificationId?: string;
  jobId?: string;
}

export async function dispatchNotification(
  prismaClient: NotificationDispatchClient,
  input: DispatchNotificationInput
): Promise<DispatchNotificationResult> {
  const existingJob = await prismaClient.notificationJob.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });
  if (existingJob) {
    return { dispatched: false, reason: "duplicate" };
  }

  let recipientEmail = input.email ?? null;
  if (!recipientEmail && input.userId) {
    const user = await prismaClient.appUser.findUnique({
      where: { id: input.userId },
      select: { email: true }
    });
    recipientEmail = user?.email ?? null;
  }

  if (!recipientEmail) {
    return { dispatched: false, reason: "no_recipient_email" };
  }

  const notification = await prismaClient.notification.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      status: "unread",
      metadata: input.payload ?? {}
    }
  });

  const job = await prismaClient.notificationJob.create({
    data: {
      id: randomUUID(),
      notificationId: notification.id,
      tenantId: input.tenantId,
      channel: "email",
      recipientEmail,
      templateKey: input.templateKey,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey,
      status: "queued",
      attemptCount: 0,
      maxAttempts: 4,
      nextAttemptAt: new Date()
    }
  });

  return { dispatched: true, notificationId: notification.id, jobId: job.id };
}

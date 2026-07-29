import { randomUUID } from "node:crypto";

import { prisma } from "@eventrax/database";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDispatchRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const {
    tenantId,
    userId,
    email,
    type,
    title,
    message,
    templateKey,
    idempotencyKey,
    payload
  } = body;

  if (
    typeof tenantId !== "string" ||
    !uuidPattern.test(tenantId) ||
    typeof userId !== "string" ||
    !uuidPattern.test(userId) ||
    typeof type !== "string" ||
    typeof title !== "string" ||
    typeof message !== "string" ||
    typeof templateKey !== "string" ||
    typeof idempotencyKey !== "string"
  ) {
    return null;
  }

  if (
    email !== undefined &&
    (typeof email !== "string" || !email.includes("@"))
  ) {
    return null;
  }

  return {
    tenantId,
    userId,
    email: typeof email === "string" ? email : undefined,
    type,
    title,
    message,
    templateKey,
    idempotencyKey,
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}
  };
}

export async function registerNotificationRoutes(app: any): Promise<void> {
  app.post("/api/v1/notifications/dispatch", async (request: any, reply: any) => {
    const body = parseDispatchRequest(request.body);
    if (!body) {
      return reply.badRequest("Notification dispatch payload is invalid");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const existingJob = await tx.notificationJob.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        include: { notification: true }
      });

      if (existingJob) {
        return {
          jobId: existingJob.id,
          notificationId: existingJob.notificationId,
          queued: false
        };
      }

      const user = await tx.appUser.findUnique({
        where: { id: body.userId },
        select: { email: true }
      });

      const recipientEmail = body.email ?? user?.email ?? null;
      if (!recipientEmail) {
        throw reply.badRequest("Recipient email is required for notification dispatch");
      }

      const notification = await tx.notification.create({
        data: {
          id: randomUUID(),
          tenantId: body.tenantId,
          userId: body.userId,
          type: body.type,
          title: body.title,
          message: body.message,
          status: "unread",
          metadata: body.payload
        }
      });

      const job = await tx.notificationJob.create({
        data: {
          id: randomUUID(),
          notificationId: notification.id,
          tenantId: body.tenantId,
          channel: "email",
          recipientEmail,
          templateKey: body.templateKey,
          payload: body.payload,
          idempotencyKey: body.idempotencyKey,
          status: "queued",
          attemptCount: 0,
          maxAttempts: 4,
          nextAttemptAt: new Date()
        }
      });

      return {
        jobId: job.id,
        notificationId: notification.id,
        queued: true
      };
    });

    return reply.code(result.queued ? 202 : 200).send(result);
  });

  app.get("/api/v1/notifications", async (request: any) => {
    const userId = typeof request.query.userId === "string" ? request.query.userId : null;
    const tenantId = typeof request.query.tenantId === "string" ? request.query.tenantId : null;

    return {
      data: await prisma.notification.findMany({
        where: {
          ...(userId ? { userId } : {}),
          ...(tenantId ? { tenantId } : {})
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50
      })
    };
  });

  app.post("/api/v1/notifications/:id/read", async (request: any, reply: any) => {
    const id = typeof request.params.id === "string" ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Notification id is required");
    }

    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound("Notification not found");
    }

    return {
      data: await prisma.notification.update({
        where: { id },
        data: {
          status: "read",
          readAt: new Date()
        }
      })
    };
  });
}

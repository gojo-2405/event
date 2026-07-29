import { randomUUID } from "node:crypto";

import { isAokWebhookCategory, verifyAokWebhookSignature } from "@eventrax/config";
import { prisma } from "@eventrax/database";

function headerValue(headers: Record<string, unknown>, name: string): string | undefined {
  const value = headers[name];
  return typeof value === "string" ? value : undefined;
}

export async function registerIntegrationWebhookRoutes(app: any): Promise<void> {
  // Fastify's default JSON parser discards the raw request body once parsed, but HMAC
  // verification must run over AOK's exact bytes — re-serializing the parsed object with
  // JSON.stringify is not guaranteed to match (key order, whitespace). Capturing the raw
  // string alongside the parsed body is the standard fix; this applies app-wide to
  // booking-service (no other route needs anything different from default JSON parsing).
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request: any, body: string, done: any) => {
      request.rawBody = body;
      if (!body) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body));
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );

  app.post("/api/v1/integration/webhooks/3d/:category", async (request: any, reply: any) => {
    const { category } = request.params;
    if (!isAokWebhookCategory(category)) {
      return reply.notFound(`Unknown AOK webhook category: ${category}`);
    }

    const rawBody: string = typeof request.rawBody === "string" ? request.rawBody : "";
    const signature = headerValue(request.headers, "x-api-signature");
    const timestamp = headerValue(request.headers, "x-api-timestamp");
    const eventId = headerValue(request.headers, "x-api-event");
    const attemptId = headerValue(request.headers, "x-api-attempt");

    const verification = verifyAokWebhookSignature({ body: rawBody, signature, timestamp });
    if (!verification.valid) {
      request.log?.warn?.(
        { category, reason: verification.reason },
        "AOK webhook signature rejected"
      );
      return reply.code(401).send({ error: "invalid_signature", reason: verification.reason });
    }

    if (!eventId) {
      return reply.badRequest("Missing X-API-Event header");
    }

    // Per AC: "same webhook twice (same idempotency key) → ... second returns 409" — this
    // applies to ANY redelivery of the same X-API-Event, not just ones already fully
    // processed. AOK may redeliver an event it hasn't gotten a fast-enough 2xx for yet
    // (that's what X-API-Attempt tracks on their side); once we've persisted it once, every
    // later delivery of the same key is a no-op 409, and the worker owns what happens next.
    const existing = await prisma.crmInboundEvent.findUnique({
      where: { idempotencyKey: eventId }
    });

    if (existing) {
      return reply.code(409).send({ data: { id: existing.id, status: existing.status } });
    }

    const rawPayload = { body: request.body ?? null, attemptId: attemptId ?? null };

    const event = await prisma.crmInboundEvent.create({
      data: {
        id: randomUUID(),
        flow: category,
        externalRef: eventId,
        idempotencyKey: eventId,
        signatureValid: true,
        rawPayload,
        status: "received",
        attemptCount: 0,
        maxAttempts: 4,
        nextAttemptAt: new Date(),
        receivedAt: new Date()
      }
    });

    return reply.code(202).send({ data: { id: event.id, status: event.status } });
  });
}

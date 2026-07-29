import { prisma, writeInvitationAuditDiff } from "@eventrax/database";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface InvitationPatchBody {
  status?: string;
  rsvpAt?: string | null;
  reconfirmed?: boolean | null;
  reconfirmedAt?: string | null;
  attended?: boolean | null;
  attendedAt?: string | null;
  cancellationReasonCode?: string | null;
  cancellationReasonText?: string | null;
  sentAt?: string | null;
}

function isIsoDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function parseInvitationId(value: unknown): string | null {
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

function parseInvitationPatchBody(value: unknown): InvitationPatchBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "status",
    "rsvpAt",
    "reconfirmed",
    "reconfirmedAt",
    "attended",
    "attendedAt",
    "cancellationReasonCode",
    "cancellationReasonText",
    "sentAt"
  ]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return null;
    }
  }

  if (Object.keys(body).length === 0) {
    return null;
  }

  const dateKeys = ["rsvpAt", "reconfirmedAt", "attendedAt", "sentAt"] as const;
  for (const key of dateKeys) {
    const entry = body[key];
    if (entry !== undefined && entry !== null && (typeof entry !== "string" || !isIsoDateString(entry))) {
      return null;
    }
  }

  const stringKeys = ["status", "cancellationReasonCode", "cancellationReasonText"] as const;
  for (const key of stringKeys) {
    const entry = body[key];
    if (entry !== undefined && entry !== null && typeof entry !== "string") {
      return null;
    }
  }

  const booleanKeys = ["reconfirmed", "attended"] as const;
  for (const key of booleanKeys) {
    const entry = body[key];
    if (entry !== undefined && entry !== null && typeof entry !== "boolean") {
      return null;
    }
  }

  return body as InvitationPatchBody;
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return new Date(value);
}

export async function registerInvitationRoutes(app: any): Promise<void> {
  app.patch("/api/v1/invitations/:id", async (request: any, reply: any) => {
    const id = parseInvitationId(request.params.id);
    const body = parseInvitationPatchBody(request.body);
    const actorId = request.headers["x-etx-user-id"];

    if (!id) {
      return reply.badRequest("Invitation id must be a UUID");
    }

    if (!body) {
      return reply.badRequest("Invitation payload is invalid");
    }

    if (typeof actorId !== "string" || actorId.trim().length === 0) {
      return reply.badRequest("x-etx-user-id header is required");
    }

    const updatedInvitation = await prisma.$transaction(async (tx: any) => {
      const invitation = await tx.invitation.findUnique({
        where: { id }
      });

      if (!invitation) {
        return null;
      }

      const updateData = {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.rsvpAt !== undefined ? { rsvpAt: parseOptionalDate(body.rsvpAt) } : {}),
        ...(body.reconfirmed !== undefined ? { reconfirmed: body.reconfirmed } : {}),
        ...(body.reconfirmedAt !== undefined
          ? { reconfirmedAt: parseOptionalDate(body.reconfirmedAt) }
          : {}),
        ...(body.attended !== undefined ? { attended: body.attended } : {}),
        ...(body.attendedAt !== undefined ? { attendedAt: parseOptionalDate(body.attendedAt) } : {}),
        ...(body.cancellationReasonCode !== undefined
          ? { cancellationReasonCode: body.cancellationReasonCode }
          : {}),
        ...(body.cancellationReasonText !== undefined
          ? { cancellationReasonText: body.cancellationReasonText }
          : {}),
        ...(body.sentAt !== undefined ? { sentAt: parseOptionalDate(body.sentAt) } : {})
      };

      const nextInvitation = await tx.invitation.update({
        where: { id },
        data: updateData
      });

      await writeInvitationAuditDiff(tx as never, {
        invitationId: invitation.id,
        changedById: actorId,
        before: {
          status: invitation.status,
          rsvpAt: invitation.rsvpAt,
          reconfirmed: invitation.reconfirmed,
          reconfirmedAt: invitation.reconfirmedAt,
          attended: invitation.attended,
          attendedAt: invitation.attendedAt,
          cancellationReasonCode: invitation.cancellationReasonCode,
          cancellationReasonText: invitation.cancellationReasonText,
          sentAt: invitation.sentAt
        },
        after: {
          status: nextInvitation.status,
          rsvpAt: nextInvitation.rsvpAt,
          reconfirmed: nextInvitation.reconfirmed,
          reconfirmedAt: nextInvitation.reconfirmedAt,
          attended: nextInvitation.attended,
          attendedAt: nextInvitation.attendedAt,
          cancellationReasonCode: nextInvitation.cancellationReasonCode,
          cancellationReasonText: nextInvitation.cancellationReasonText,
          sentAt: nextInvitation.sentAt
        }
      });

      return nextInvitation;
    });

    if (!updatedInvitation) {
      return reply.notFound("Invitation not found");
    }

    return {
      data: updatedInvitation
    };
  });

  app.get("/api/v1/invitations/:id/audit", async (request: any, reply: any) => {
    const id = parseInvitationId(request.params.id);

    if (!id) {
      return reply.badRequest("Invitation id must be a UUID");
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!invitation) {
      return reply.notFound("Invitation not found");
    }

    const audits = await prisma.invitationAudit.findMany({
      where: { invitationId: id },
      orderBy: [{ changedAt: "desc" }, { id: "desc" }]
    });

    return {
      data: audits
    };
  });
}

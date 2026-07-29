import { randomUUID } from "node:crypto";

import { dispatchNotification, prisma, writeInvitationAuditDiff } from "@eventrax/database";

// Same `db as any` escape hatch used across this repo's route files (see publishing-routes.ts).
const db = prisma as any;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && uuidPattern.test(v);

async function writeAudit(params: {
  tenantId: string | null;
  actor: string;
  action: string;
  entityId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      id: randomUUID(),
      tenantId: params.tenantId,
      actor: params.actor,
      action: params.action,
      entityType: "booking",
      entityId: params.entityId,
      metadata: params.metadata,
      createdAt: new Date()
    }
  });
}

function serializeBooking(b: any) {
  const requester = b.requester ?? null;
  const invitation = Array.isArray(b.invitations) ? (b.invitations[0] ?? null) : null;
  const name = requester
    ? [requester.firstName, requester.lastName].filter(Boolean).join(" ").trim() || requester.email || "Unknown"
    : "Unknown";
  return {
    id: b.id,
    eventId: b.eventId,
    requesterId: b.requesterId,
    requesterName: name,
    requesterEmail: requester?.email ?? null,
    requesterRole: requester?.role ?? null,
    seatsRequested: b.seatsRequested ?? 1,
    status: b.status,
    purpose: b.purpose ?? null,
    createdAt: b.createdAt,
    invitationId: invitation?.id ?? null,
    invitationStatus: invitation?.status ?? null,
    invitationSentAt: invitation?.sentAt ?? null,
    guestId: invitation?.guestId ?? null
  };
}

/**
 * Booking flow (FRD Epic 3): a Requester books a published Listing, which creates a
 * pending-approval booking that surfaces in the CEM's Requests tab. Approval moves it to the
 * Guest List and counts it toward utilisation (the event-list route only sums `confirmed`/
 * `completed` seats). Rejection leaves inventory untouched.
 *
 * No auth middleware resolves an actor yet (E20-20 pending), so callers pass requesterId/actorId
 * directly — same posture as event-routes.ts / publishing-routes.ts.
 */
export async function registerBookingRoutes(app: any): Promise<void> {
  // Requester books an event -> creates a pending-approval booking (does NOT reserve a seat or
  // count toward utilisation until a CEM approves it).
  app.post("/api/v1/events/:id/bookings", async (request: any, reply: any) => {
    const eventId = isUuid(request.params.id) ? request.params.id : null;
    if (!eventId) return reply.badRequest("Event id must be a UUID");

    const body = (request.body ?? {}) as Record<string, unknown>;
    const requesterId = isUuid(body.requesterId) ? (body.requesterId as string) : null;
    if (!requesterId) return reply.badRequest("requesterId (UUID) is required");
    const purpose = typeof body.purpose === "string" ? body.purpose : null;

    const event = await db.event.findUnique({
      where: { id: eventId },
      include: { inventoryItems: true }
    });
    if (!event) return reply.notFound("Event not found");
    if (!event.publishedAt) return reply.badRequest("This listing is not published");
    if (event.status === "cancelled") return reply.badRequest("Cannot book a cancelled event");

    const inventoryItem = (event.inventoryItems ?? [])[0];
    if (!inventoryItem) return reply.badRequest("This event has no inventory to book against");

    // One active booking per requester per event — re-booking after a rejection/cancellation is
    // allowed, but a duplicate pending/confirmed request is not.
    const existing = await db.booking.findFirst({
      where: {
        eventId,
        requesterId,
        status: { in: ["pending", "pending_approval", "confirmed", "approved"] }
      }
    });
    if (existing) {
      return reply.conflict("You already have an active booking or request for this event");
    }

    const created = await db.booking.create({
      data: {
        id: randomUUID(),
        tenantId: event.tenantId,
        eventId,
        inventoryItemId: inventoryItem.id,
        requesterId,
        bookedById: requesterId,
        seatsRequested: 1,
        status: "pending_approval",
        purpose,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: { requester: true, invitations: true }
    });

    await writeAudit({
      tenantId: event.tenantId,
      actor: requesterId,
      action: "booking.requested",
      entityId: created.id,
      metadata: { eventId, seatsRequested: 1 }
    });

    return reply.code(201).send({ data: serializeBooking(created) });
  });

  // List bookings for an event, optionally filtered by status. Powers both the CEM Requests tab
  // (?status=pending_approval) and the Guest List (?status=confirmed).
  app.get("/api/v1/events/:id/bookings", async (request: any, reply: any) => {
    const eventId = isUuid(request.params.id) ? request.params.id : null;
    if (!eventId) return reply.badRequest("Event id must be a UUID");

    const statusQuery = typeof request.query?.status === "string" ? request.query.status : null;

    const bookings = await db.booking.findMany({
      where: {
        eventId,
        ...(statusQuery ? { status: { in: statusQuery.split(",") } } : {})
      },
      include: { requester: true, invitations: true },
      orderBy: { createdAt: "asc" }
    });

    return { data: bookings.map(serializeBooking) };
  });

  // CEM approves a request -> confirmed + reserves a seat (decrements availableSeats). This is
  // what makes it count toward utilisation and appear on the Guest List.
  app.post("/api/v1/events/:id/bookings/:bookingId/approve", async (request: any, reply: any) => {
    const bookingId = isUuid(request.params.bookingId) ? request.params.bookingId : null;
    if (!bookingId) return reply.badRequest("Booking id must be a UUID");
    const body = (request.body ?? {}) as Record<string, unknown>;
    const actorId = isUuid(body.actorId) ? (body.actorId as string) : "unknown";

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        requester: true,
        event: { select: { title: true } },
        invitations: true
      }
    });
    if (!booking) return reply.notFound("Booking not found");
    const alreadyConfirmed = booking.status === "confirmed";

    const result = await db
      .$transaction(async (tx: any) => {
        const now = new Date();

        if (!alreadyConfirmed) {
          const inventoryItem = await tx.inventoryItem.findUnique({ where: { id: booking.inventoryItemId } });
          const seats = booking.seatsRequested ?? 1;
          if (!inventoryItem || (inventoryItem.availableSeats ?? 0) < seats) {
            throw new Error("NO_SEATS");
          }

          await tx.inventoryItem.update({
            where: { id: inventoryItem.id },
            data: {
              availableSeats: (inventoryItem.availableSeats ?? 0) - seats,
              version: (inventoryItem.version ?? 1) + 1,
              updatedAt: now
            }
          });

          await tx.booking.update({
            where: { id: bookingId },
            data: { status: "confirmed", updatedAt: now }
          });
        }

        let guest = null;
        const requesterEmail = booking.requester?.email ?? null;
        if (requesterEmail) {
          guest = await tx.guest.findFirst({
            where: {
              tenantId: booking.tenantId,
              email: requesterEmail
            }
          });
        }

        if (!guest) {
          guest = await tx.guest.create({
            data: {
              id: randomUUID(),
              tenantId: booking.tenantId,
              firstName: booking.requester?.firstName ?? null,
              lastName: booking.requester?.lastName ?? null,
              email: requesterEmail,
              createdAt: now,
              updatedAt: now
            }
          });
        }

        const existingInvitation = await tx.invitation.findFirst({
          where: { bookingId },
          orderBy: { createdAt: "asc" }
        });

        let invitation = existingInvitation;
        let invitationChanged = false;

        if (!existingInvitation) {
          invitation = await tx.invitation.create({
            data: {
              id: randomUUID(),
              bookingId,
              guestId: guest.id,
              status: "sent",
              sentAt: now,
              createdAt: now,
              updatedAt: now
            }
          });
          invitationChanged = true;

          await writeInvitationAuditDiff(tx as never, {
            invitationId: invitation.id,
            changedById: actorId,
            before: {},
            after: {
              bookingId,
              guestId: guest.id,
              status: "sent",
              sentAt: now
            }
          });
        } else {
          const nextInvitationState = {
            guestId: existingInvitation.guestId ?? guest.id,
            status: existingInvitation.status ?? "sent",
            sentAt: existingInvitation.sentAt ?? now
          };

          if (
            nextInvitationState.guestId !== existingInvitation.guestId ||
            nextInvitationState.status !== existingInvitation.status ||
            (nextInvitationState.sentAt?.getTime?.() ?? 0) !== (existingInvitation.sentAt?.getTime?.() ?? 0)
          ) {
            invitation = await tx.invitation.update({
              where: { id: existingInvitation.id },
              data: {
                guestId: nextInvitationState.guestId,
                status: nextInvitationState.status,
                sentAt: nextInvitationState.sentAt,
                updatedAt: now
              }
            });
            invitationChanged = true;

            await writeInvitationAuditDiff(tx as never, {
              invitationId: existingInvitation.id,
              changedById: actorId,
              before: {
                guestId: existingInvitation.guestId,
                status: existingInvitation.status,
                sentAt: existingInvitation.sentAt
              },
              after: {
                guestId: invitation.guestId,
                status: invitation.status,
                sentAt: invitation.sentAt
              }
            });
          }
        }

        const updatedBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { requester: true, invitations: true }
        });

        return {
          booking: updatedBooking,
          guest,
          invitation,
          invitationChanged
        };
      })
      .catch((err: any) => {
        if (err?.message === "NO_SEATS") return null;
        throw err;
      });

    if (!result) return reply.conflict("No seats remaining to approve this booking");

    if (!alreadyConfirmed) {
      await writeAudit({
        tenantId: booking.tenantId,
        actor: actorId,
        action: "booking.approved",
        entityId: bookingId,
        metadata: { eventId: booking.eventId }
      });
    }

    let inviteDispatchResult:
      | { dispatched: boolean; reason?: "duplicate" | "no_recipient_email"; notificationId?: string; jobId?: string }
      | undefined;

    if (booking.tenantId && result.invitation && result.invitationChanged) {
      inviteDispatchResult = await dispatchNotification(prisma, {
        tenantId: booking.tenantId,
        userId: booking.requesterId,
        type: "invitation_update",
        title: "Your booking was approved",
        message: `Your RSVP invite for "${booking.event?.title ?? "this listing"}" is ready.`,
        templateKey: "booking-approved",
        idempotencyKey: `booking-approved:${bookingId}:invitation`,
        payload: {
          eventId: booking.eventId,
          bookingId,
          invitationId: result.invitation.id,
          guestId: result.guest?.id ?? null
        }
      });

      await writeAudit({
        tenantId: booking.tenantId,
        actor: actorId,
        action: "invitation.sent",
        entityId: bookingId,
        metadata: {
          eventId: booking.eventId,
          invitationId: result.invitation.id,
          guestId: result.guest?.id ?? null,
          notificationDispatched: inviteDispatchResult.dispatched,
          notificationReason: inviteDispatchResult.reason ?? null
        }
      });
    }

    return {
      data: serializeBooking(result.booking),
      alreadyApproved: alreadyConfirmed,
      invitationQueued: inviteDispatchResult?.dispatched ?? false
    };
  });

  // CEM rejects a request -> rejected, inventory untouched.
  app.post("/api/v1/events/:id/bookings/:bookingId/reject", async (request: any, reply: any) => {
    const bookingId = isUuid(request.params.bookingId) ? request.params.bookingId : null;
    if (!bookingId) return reply.badRequest("Booking id must be a UUID");
    const body = (request.body ?? {}) as Record<string, unknown>;
    const actorId = isUuid(body.actorId) ? (body.actorId as string) : "unknown";

    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return reply.notFound("Booking not found");

    const updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: "rejected", updatedAt: new Date() },
      include: { requester: true, invitations: true }
    });

    await writeAudit({
      tenantId: booking.tenantId,
      actor: actorId,
      action: "booking.rejected",
      entityId: bookingId,
      metadata: { eventId: booking.eventId }
    });

    return { data: serializeBooking(updated) };
  });
}

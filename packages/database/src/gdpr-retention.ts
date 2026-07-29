import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

// E20-59: GDPR Data Retention + Purge. Only "guest" has a real implementation — no
// "GuestInvite"/"ExternalGuest" models exist anywhere in this schema (the ticket's terms);
// Guest is the real PII holder that maps to what the ticket describes. AppUser also holds
// PII but is deliberately out of scope here: it's an internal system account, and blanket
// GDPR-guest-style purging of internal users is a different, riskier problem this ticket
// doesn't actually describe.
export const RETENTION_SUPPORTED_ENTITIES = ["guest"] as const;
export type RetentionSupportedEntity = (typeof RETENTION_SUPPORTED_ENTITIES)[number];

const REDACTED = "[redacted]";

interface GuestRow {
  id: string;
  tenantId: string | null;
  createdAt: Date | null;
  deletedAt: Date | null;
}

type InvitationWithBookingAndEvent = Prisma.InvitationGetPayload<{
  include: { booking: { include: { event: true } } };
}>;

export interface GdprRetentionClient {
  guest: {
    findMany(args: Prisma.GuestFindManyArgs): PromiseLike<unknown>;
    findUnique(args: Prisma.GuestFindUniqueArgs): PromiseLike<unknown>;
    update(args: Prisma.GuestUpdateArgs): Promise<unknown>;
  };
  invitation: {
    findMany(args: Prisma.InvitationFindManyArgs): PromiseLike<unknown>;
    updateMany(args: Prisma.InvitationUpdateManyArgs): Promise<unknown>;
  };
  auditLog: {
    create(args: Prisma.AuditLogCreateArgs): Promise<unknown>;
  };
}

// Booking statuses considered final for the purposes of the retention "active dependency"
// gate — matches the terminal-status convention used elsewhere (e.g. ENQUIRY_STATUS_MIRROR
// _TERMINAL_STATUSES). Anything not in this set, or a booking on an event that hasn't
// finished yet, counts as an active dependency.
const TERMINAL_BOOKING_STATUSES = ["cancelled", "completed"];

/**
 * "Data referenced by active event -> retained until dependency clears." A guest has an
 * active dependency if any of their invitations belong to a booking that isn't in a terminal
 * status, or whose event hasn't finished yet (or has no end date at all, treated as
 * open-ended/active).
 */
export async function hasActiveDependency(
  prismaClient: GdprRetentionClient,
  guestId: string,
  now: Date = new Date()
): Promise<boolean> {
  const invitations = (await prismaClient.invitation.findMany({
    where: { guestId },
    include: { booking: { include: { event: true } } }
  })) as InvitationWithBookingAndEvent[];

  return invitations.some((invitation) => {
    const booking = invitation.booking;
    if (!booking) return false;
    const status = booking.status ?? "";
    if (!TERMINAL_BOOKING_STATUSES.includes(status)) return true;
    const endDate = booking.event?.endDate ?? null;
    if (!endDate) return true;
    return endDate.getTime() > now.getTime();
  });
}

async function writeAuditLog(
  prismaClient: GdprRetentionClient,
  input: {
    tenantId: string | null;
    actor: string;
    action: string;
    entityId: string;
    metadata?: Prisma.InputJsonObject;
  }
): Promise<void> {
  await prismaClient.auditLog.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      actor: input.actor,
      action: input.action,
      entityType: "guest",
      entityId: input.entityId,
      metadata: input.metadata ?? {},
      createdAt: new Date()
    }
  });
}

/**
 * Both "purge" and "anonymise" modes are implemented as full PII anonymisation + soft-delete
 * (deletedAt), never a literal SQL DELETE — Invitation rows reference Guest, and this schema
 * has no ON DELETE CASCADE for that relation, so a hard delete would either fail against a
 * real FK constraint or silently orphan invitation history. This also satisfies "aggregate
 * history intact": the Guest row (and its id) still exists for any joins, just with no
 * retrievable PII. Documented as a deliberate interpretation, not a literal reading of
 * "purge".
 */
async function anonymiseAndRevoke(prismaClient: GdprRetentionClient, guest: GuestRow): Promise<void> {
  await prismaClient.guest.update({
    where: { id: guest.id },
    data: {
      firstName: REDACTED,
      lastName: REDACTED,
      email: null,
      company: null,
      phone: null,
      dietaryRequirements: null,
      accessibilityNeeds: null,
      deletedAt: new Date()
    }
  });

  // Revoke RSVP tokens — "Right-to-erasure -> ... RSVP tokens revoked".
  await prismaClient.invitation.updateMany({
    where: { guestId: guest.id },
    data: { token: null, tokenExpiresAt: new Date() }
  });
}

export interface RetentionSweepPolicy {
  id: string;
  tenantId: string | null;
  entity: string;
  retainDays: number;
  mode: "purge" | "anonymise" | string;
  isActive: boolean;
}

export interface RetentionSweepResult {
  scanned: number;
  processed: number;
  retainedActive: number;
}

/**
 * The nightly (per E20-53's precedent, an endpoint someone/something calls — there is no
 * real cron/scheduler anywhere in this repo) sweep for one policy row. Gated by
 * GDPR_RETENTION_ENABLED at the route layer, not here — this function assumes the caller has
 * already confirmed the feature is enabled.
 */
export async function runRetentionSweep(
  prismaClient: GdprRetentionClient,
  policy: RetentionSweepPolicy,
  now: Date = new Date()
): Promise<RetentionSweepResult> {
  if (policy.entity !== "guest" || !policy.isActive) {
    return { scanned: 0, processed: 0, retainedActive: 0 };
  }

  const cutoff = new Date(now.getTime() - policy.retainDays * 24 * 60 * 60 * 1000);

  const candidates = await prismaClient.guest.findMany({
    where: {
      ...(policy.tenantId ? { tenantId: policy.tenantId } : {}),
      deletedAt: null,
      createdAt: { lte: cutoff }
    }
  }) as GuestRow[];

  let processed = 0;
  let retainedActive = 0;

  for (const guest of candidates) {
    if (await hasActiveDependency(prismaClient, guest.id, now)) {
      retainedActive += 1;
      continue;
    }

    await anonymiseAndRevoke(prismaClient, guest);
    await writeAuditLog(prismaClient, {
      tenantId: guest.tenantId,
      actor: "worker:gdpr-retention-sweep",
      action: policy.mode === "purge" ? "gdpr.guest_purged" : "gdpr.guest_anonymised",
      entityId: guest.id,
      metadata: { policyId: policy.id, retainDays: policy.retainDays }
    });
    processed += 1;
  }

  return { scanned: candidates.length, processed, retainedActive };
}

export interface EraseGuestResult {
  erased: boolean;
  reason?: "not_found";
}

/**
 * Right-to-erasure. Unlike the policy sweep, this does NOT check hasActiveDependency — a
 * data subject's erasure request is a legal right that isn't conditioned on "an event hasn't
 * finished yet" the way the ticket's routine retention-policy AC is. This interpretation is
 * documented, not explicit in the ticket text (the "active dependency" AC isn't scoped to
 * one path or the other), since erasure and automated retention are different obligations.
 */
export async function eraseGuest(
  prismaClient: GdprRetentionClient,
  guestId: string,
  actor: string
): Promise<EraseGuestResult> {
  const guest = (await prismaClient.guest.findUnique({ where: { id: guestId } })) as GuestRow | null;
  if (!guest) {
    return { erased: false, reason: "not_found" };
  }

  await anonymiseAndRevoke(prismaClient, guest);
  await writeAuditLog(prismaClient, {
    tenantId: guest.tenantId,
    actor,
    action: "gdpr.guest_erased",
    entityId: guest.id,
    metadata: { requestType: "right_to_erasure" }
  });

  return { erased: true };
}

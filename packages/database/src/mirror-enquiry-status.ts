import { randomUUID } from "node:crypto";

// AOK's real Booking.status enum (confirmed against their OpenAPI spec) has no equivalent
// to the ticket's "rejected" state, and there is no separate "proposals_sent"/
// "proposal_accepted" webhook — this whole module exists because AOK only tells us
// BookingSpawned/Ignored via webhook, then never pushes anything else. Everything else here
// is derived from polling GET /api/v1/bookings/{bookingId}.
export const AOK_BOOKING_STATUS_TO_ENQUIRY_STATUS: Record<string, string> = {
  InNegotiation: "in_progress",
  Unreviewed: "in_progress",
  Offered: "proposals_sent",
  Accepted: "accepted",
  Completed: "closed",
  Cancelled: "cancelled"
};

export function mapAokBookingStatusToEnquiryStatus(status: string): string {
  return AOK_BOOKING_STATUS_TO_ENQUIRY_STATUS[status] ?? "in_progress";
}

// Statuses at which the periodic poll stops re-checking this enquiry.
export const ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES = ["accepted", "closed", "cancelled"] as const;

export interface MirrorAokBookingOffer {
  offered: string;
  accepted?: boolean;
  offeredBy: string;
}

export interface MirrorAokBookingDetails {
  id: number;
  status: string;
  offers?: MirrorAokBookingOffer[];
}

export interface EnquiryStatusMirrorAokClient {
  getBooking(bookingId: number): Promise<MirrorAokBookingDetails>;
}

interface EnquiryRow {
  id: string;
  tenantId: string | null;
  submittedById: string | null;
}

export interface EnquiryStatusMirrorClient {
  enquiry: {
    findUnique(args: unknown): Promise<EnquiryRow | null>;
    update(args: unknown): Promise<unknown>;
  };
  enquiryProposal: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  notification: {
    create(args: unknown): Promise<{ id: string }>;
  };
  notificationJob: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<unknown>;
  };
  appUser: {
    findUnique(args: unknown): Promise<{ email: string | null } | null>;
  };
}

export interface MirrorEnquiryStatusInput {
  enquiryId: string;
  bookingId: number;
}

export interface MirrorEnquiryStatusResult {
  handled: boolean;
  reason?: "unknown_enquiry";
  status?: string;
  proposalsSynced?: number;
  notified?: boolean;
}

/**
 * Pulls the current status/offers for an AOK booking and mirrors them onto our Enquiry +
 * EnquiryProposal rows, per E20-58. Intended to be called both once, right after a
 * BookingSpawned webhook arrives (route-inbound-flow.ts), and repeatedly by a periodic
 * worker poll (apps/worker-service enquiry-status-mirror-routes.ts) since AOK never webhooks
 * booking status/offer changes after the initial spawn.
 */
export async function mirrorEnquiryStatusFromBooking(
  prismaClient: EnquiryStatusMirrorClient,
  aokClient: EnquiryStatusMirrorAokClient,
  input: MirrorEnquiryStatusInput
): Promise<MirrorEnquiryStatusResult> {
  const enquiry = await prismaClient.enquiry.findUnique({ where: { id: input.enquiryId } });
  if (!enquiry) {
    return { handled: false, reason: "unknown_enquiry" };
  }

  const booking = await aokClient.getBooking(input.bookingId);
  const offers = booking.offers ?? [];

  let proposalsSynced = 0;
  let hasAcceptedOffer = false;

  for (const offer of offers) {
    if (offer.accepted === true) {
      hasAcceptedOffer = true;
    }

    // AOK's BookingOffer has no stable id of its own — (enquiryId, offered timestamp) is
    // the best available natural dedupe key.
    const crmOfferedAt = new Date(offer.offered);
    const existing = await prismaClient.enquiryProposal.findFirst({
      where: { enquiryId: input.enquiryId, crmOfferedAt }
    });

    const data = {
      notes: offer.offeredBy ? `Offered by ${offer.offeredBy}` : null,
      isSelected: offer.accepted === true,
      crmOfferedAt
    };

    if (existing) {
      await prismaClient.enquiryProposal.update({ where: { id: existing.id }, data });
    } else {
      await prismaClient.enquiryProposal.create({
        data: { id: randomUUID(), enquiryId: input.enquiryId, createdAt: new Date(), ...data }
      });
    }

    proposalsSynced += 1;
  }

  // An explicitly accepted offer overrides the booking-level status mapping — matches the
  // ticket's "proposal_accepted -> Proposal selected, enquiry accepted" even if AOK's own
  // Booking.status hasn't (yet) flipped to "Accepted".
  const status = hasAcceptedOffer ? "accepted" : mapAokBookingStatusToEnquiryStatus(booking.status);

  await prismaClient.enquiry.update({
    where: { id: input.enquiryId },
    data: { status, crmLastSyncAt: new Date() }
  });

  const notified = await notifyRequestorOfStatus(prismaClient, enquiry, input, status);

  return { handled: true, status, proposalsSynced, notified };
}

// Idempotency key is deterministic on (enquiryId, status), not a random value — repeated
// polls that land on the same status are a no-op, matching "duplicate/out-of-order events
// -> state machine consistent" / "no duplicate notifications" from the ACs. A genuine status
// transition produces a new key and a new notification.
async function notifyRequestorOfStatus(
  prismaClient: EnquiryStatusMirrorClient,
  enquiry: EnquiryRow,
  input: MirrorEnquiryStatusInput,
  status: string
): Promise<boolean> {
  if (!enquiry.submittedById || !enquiry.tenantId) {
    return false;
  }

  const idempotencyKey = `enquiry-status-mirror:${input.enquiryId}:${status}`;
  const existingJob = await prismaClient.notificationJob.findUnique({ where: { idempotencyKey } });
  if (existingJob) {
    return false;
  }

  const user = await prismaClient.appUser.findUnique({
    where: { id: enquiry.submittedById },
    select: { email: true }
  });

  if (!user?.email) {
    return false;
  }

  const notification = await prismaClient.notification.create({
    data: {
      id: randomUUID(),
      tenantId: enquiry.tenantId,
      userId: enquiry.submittedById,
      type: "enquiry.status_mirrored",
      title: "Your enquiry status has been updated",
      message: `Your enquiry is now: ${status}`,
      status: "unread",
      metadata: { enquiryId: input.enquiryId, bookingId: input.bookingId, status }
    }
  });

  await prismaClient.notificationJob.create({
    data: {
      id: randomUUID(),
      notificationId: notification.id,
      tenantId: enquiry.tenantId,
      channel: "email",
      recipientEmail: user.email,
      templateKey: "enquiry-status-update",
      payload: { status },
      idempotencyKey,
      status: "queued",
      attemptCount: 0,
      maxAttempts: 4,
      nextAttemptAt: new Date()
    }
  });

  return true;
}

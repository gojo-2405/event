import {
  parseEnquiryWebhookPayload,
  reconcileEnquiryDispatch,
  type EnquiryDispatchReconciler
} from "./reconcile-enquiry-dispatch.js";

// Mirrors packages/config's AOK_WEBHOOK_CATEGORIES (kept as a small local duplicate rather
// than a new packages/database -> packages/config dependency for one constant list).
export const AOK_WEBHOOK_CATEGORIES = [
  "booking",
  "client",
  "contact",
  "enquiry",
  "organisation"
] as const;

export type AokWebhookCategory = (typeof AOK_WEBHOOK_CATEGORIES)[number];

export interface InboundFlowOutcome {
  status: "processed" | "parked";
  note?: string;
}

export type InboundFlowHandler = (payload: unknown) => Promise<InboundFlowOutcome>;

// Extends the dispatch-reconciler shape with enquiry.update, needed only for the
// BookingSpawned -> crmBookingRef bookkeeping below (E20-58). Kept as a separate interface
// rather than widening EnquiryDispatchReconciler itself, since reconcileEnquiryDispatch
// doesn't need it.
export interface InboundFlowPrismaClient extends EnquiryDispatchReconciler {
  enquiry: {
    update(args: unknown): Promise<unknown>;
  };
}

// Only "enquiry" has real business logic today, reusing the same reconciliation logic the
// legacy /api/v1/webhooks/aok/enquiries endpoint uses. The other four AOK webhook
// categories (booking, client, contact, organisation) have no confirmed payload shape or
// business requirement anywhere in this repo yet, so they're parked rather than guessed
// at — same posture the team already took on outbound flows 1-8's business mapping.
function buildHandlers(prismaClient: InboundFlowPrismaClient): Record<AokWebhookCategory, InboundFlowHandler> {
  return {
    enquiry: async (payload) => {
      const parsed = parseEnquiryWebhookPayload(payload);
      if (!parsed) {
        return { status: "parked", note: "enquiry webhook payload did not match the known shape" };
      }

      const result = await reconcileEnquiryDispatch(prismaClient, parsed);
      if (!result.handled) {
        return { status: "parked", note: "no matching EnquiryDispatch found for this crmRef" };
      }

      // E20-58: record AOK's booking id so the periodic status-mirror poll knows which
      // booking to fetch. AOK's webhook only ever tells us this once, on BookingSpawned —
      // it's never re-sent, so this is the only place it can be captured.
      if (parsed.action === "BookingSpawned" && parsed.bookingId !== undefined) {
        const dispatch = result.dispatch as { enquiryId?: string } | undefined;
        if (dispatch?.enquiryId) {
          await prismaClient.enquiry.update({
            where: { id: dispatch.enquiryId },
            data: { crmBookingRef: parsed.bookingId }
          });
        }
      }

      return { status: "processed" };
    },
    booking: async () => ({ status: "parked", note: "booking category has no handler yet" }),
    client: async () => ({ status: "parked", note: "client category has no handler yet" }),
    contact: async () => ({ status: "parked", note: "contact category has no handler yet" }),
    organisation: async () => ({
      status: "parked",
      note: "organisation category has no handler yet"
    })
  };
}

export async function routeInboundFlow(
  prismaClient: InboundFlowPrismaClient,
  category: AokWebhookCategory,
  payload: unknown
): Promise<InboundFlowOutcome> {
  const handlers = buildHandlers(prismaClient);
  return handlers[category](payload);
}

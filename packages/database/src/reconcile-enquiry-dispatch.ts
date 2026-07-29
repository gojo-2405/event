export interface EnquiryReconciliationInput {
  action?: "Ignored" | "BookingSpawned";
  enquiryId: number;
  bookingId?: number;
}

export interface EnquiryReconciliationResult {
  handled: boolean;
  dispatch?: unknown;
}

export interface EnquiryDispatchReconciler {
  enquiryDispatch: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    update(args: unknown): Promise<unknown>;
  };
}

export function parseEnquiryWebhookPayload(value: unknown): EnquiryReconciliationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (
    (body.action !== undefined && body.action !== "Ignored" && body.action !== "BookingSpawned") ||
    typeof body.enquiryId !== "number" ||
    (body.bookingId !== undefined && typeof body.bookingId !== "number")
  ) {
    return null;
  }

  return {
    action: body.action as "Ignored" | "BookingSpawned" | undefined,
    enquiryId: body.enquiryId,
    bookingId: body.bookingId as number | undefined
  };
}

/**
 * Shared reconciliation logic for AOK's "enquiry" webhook category. Lives here (not in
 * booking-service) because worker-service's inbound-event drain (E20-53) needs to call the
 * exact same logic booking-service's legacy webhook endpoint uses — apps can't import each
 * other's code in this monorepo, only shared packages. Takes the Prisma client as an
 * argument rather than importing the singleton, same pattern as writeInvitationAuditDiff
 * in audit.ts, to avoid a circular import with this package's own index.ts.
 */
export async function reconcileEnquiryDispatch(
  prismaClient: EnquiryDispatchReconciler,
  input: EnquiryReconciliationInput
): Promise<EnquiryReconciliationResult> {
  const dispatch = await prismaClient.enquiryDispatch.findFirst({
    where: { crmRef: String(input.enquiryId) },
    orderBy: { createdAt: "desc" }
  });

  if (!dispatch) {
    return { handled: false };
  }

  const updated = await prismaClient.enquiryDispatch.update({
    where: { id: dispatch.id },
    data: {
      status: input.action === "BookingSpawned" ? "reconciled" : "processed",
      responsePayload: {
        action: input.action ?? null,
        enquiryId: input.enquiryId,
        bookingId: input.bookingId ?? null
      },
      processedAt: new Date()
    }
  });

  return { handled: true, dispatch: updated };
}

import { createAokClient } from "@eventrax/config";
import {
  ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES,
  mirrorEnquiryStatusFromBooking,
  prisma
} from "@eventrax/database";

/**
 * E20-58: AOK has no webhook for booking status/offer changes — only the one-time
 * enquiry BookingSpawned/Ignored event (E20-53/E20-57). This periodic drain is how
 * InNegotiation -> Offered -> Accepted/Completed/Cancelled progression actually reaches
 * ETX2: it re-polls GET /api/v1/bookings/{bookingId} for every enquiry that has a
 * crmBookingRef and isn't already in a terminal client-facing status. Same "requires an
 * external caller" posture as E20-53's /jobs/integration/reconcile — there is no real
 * cron/scheduler anywhere in this repo.
 */
export async function registerEnquiryStatusMirrorRoutes(app: any): Promise<void> {
  app.post("/api/v1/jobs/enquiries/status-mirror/drain", async (request: any) => {
    const limit =
      typeof request.body?.limit === "number" && request.body.limit > 0 ? request.body.limit : 10;
    const aokClient = createAokClient();

    const enquiries = await prisma.enquiry.findMany({
      where: {
        crmBookingRef: { not: null },
        NOT: { status: { in: [...ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES] } }
      },
      orderBy: [{ crmLastSyncAt: "asc" }, { id: "asc" }],
      take: limit
    });

    let synced = 0;
    let unknown = 0;
    let failed = 0;

    for (const enquiry of enquiries) {
      try {
        const result = await mirrorEnquiryStatusFromBooking(prisma, aokClient, {
          enquiryId: enquiry.id,
          bookingId: enquiry.crmBookingRef as number
        });

        if (!result.handled) {
          unknown += 1;
          // Per AC: "Unknown crm_ref -> parked/flagged, alerted". No generic AuditLog or
          // alerting channel exists in this codebase yet (same gap noted for E20-53's DLQ) —
          // this structured log line is the stand-in.
          app.log.warn(
            {
              audit: true,
              actor: "worker:enquiry-status-mirror",
              action: "enquiry.status_mirror.unknown",
              enquiryId: enquiry.id,
              bookingId: enquiry.crmBookingRef,
              reason: result.reason
            },
            "Enquiry status mirror could not resolve enquiry"
          );
          continue;
        }

        synced += 1;
      } catch (error) {
        failed += 1;
        app.log.error(
          {
            audit: true,
            actor: "worker:enquiry-status-mirror",
            action: "enquiry.status_mirror.failed",
            enquiryId: enquiry.id,
            bookingId: enquiry.crmBookingRef,
            error: error instanceof Error ? error.message : "Unknown status mirror failure"
          },
          "Enquiry status mirror poll failed"
        );
      }
    }

    return {
      processed: enquiries.length,
      synced,
      unknown,
      failed
    };
  });
}

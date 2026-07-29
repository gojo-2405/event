import { randomUUID } from "node:crypto";

import { loadConfig } from "@eventrax/config";
import {
  dispatchNotification,
  ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES,
  parseEnquiryWebhookPayload,
  prisma,
  reconcileEnquiryDispatch
} from "@eventrax/database";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function parseDispatchPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (
    !isUuid(body.enquiryId) ||
    typeof body.mode !== "string" ||
    typeof body.details !== "string"
  ) {
    return null;
  }

  if (body.mode !== "public" && body.mode !== "existing_contact") {
    return null;
  }

  if (body.mode === "existing_contact" && typeof body.contactId !== "number") {
    return null;
  }

  return {
    enquiryId: body.enquiryId,
    // Idempotency key is the enquiry id itself, not caller-supplied — this is what
    // guarantees "routed exactly once" per E20-57's AC regardless of what a client sends.
    dispatchKey: body.enquiryId,
    mode: body.mode as "public" | "existing_contact",
    contactId: typeof body.contactId === "number" ? body.contactId : undefined,
    enquirySource:
      typeof body.enquirySource === "string" && body.enquirySource.length > 0
        ? body.enquirySource
        : loadConfig().AOK_ENQUIRY_SOURCE_DEFAULT,
    details: body.details,
    publicContact:
      body.publicContact && typeof body.publicContact === "object" && !Array.isArray(body.publicContact)
        ? (body.publicContact as Record<string, unknown>)
        : {}
  };
}

function parseCreateEnquiryPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  if (!isUuid(body.tenantId) || !isUuid(body.submittedById) || typeof body.details !== "string") {
    return null;
  }

  const mode = body.mode === "existing_contact" ? "existing_contact" : "public";
  if (mode === "existing_contact" && typeof body.contactId !== "number") {
    return null;
  }

  // parsedDate guards against passing an invalid date string straight to Prisma, which would
  // throw a raw driver error rather than a clean 400.
  let preferredDate: Date | undefined;
  if (typeof body.preferredDate === "string" && body.preferredDate.length > 0) {
    const parsedDate = new Date(body.preferredDate);
    if (Number.isNaN(parsedDate.getTime())) return null;
    preferredDate = parsedDate;
  }

  return {
    tenantId: body.tenantId,
    submittedById: body.submittedById,
    enquiryType: typeof body.enquiryType === "string" ? body.enquiryType : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    purpose: typeof body.purpose === "string" ? body.purpose : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    preferredDate,
    preferredLocation: typeof body.preferredLocation === "string" ? body.preferredLocation : undefined,
    budget: typeof body.budget === "number" ? body.budget : undefined,
    currency: typeof body.currency === "string" ? body.currency : undefined,
    taxAmount: typeof body.taxAmount === "number" ? body.taxAmount : undefined,
    guestCount: typeof body.guestCount === "number" ? body.guestCount : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    attachmentUrls: Array.isArray(body.attachmentUrls)
      ? body.attachmentUrls.filter((url): url is string => typeof url === "string")
      : [],
    mode: mode as "public" | "existing_contact",
    contactId: typeof body.contactId === "number" ? body.contactId : undefined,
    enquirySource:
      typeof body.enquirySource === "string" && body.enquirySource.length > 0
        ? body.enquirySource
        : loadConfig().AOK_ENQUIRY_SOURCE_DEFAULT,
    details: body.details,
    publicContact:
      body.publicContact && typeof body.publicContact === "object" && !Array.isArray(body.publicContact)
        ? (body.publicContact as Record<string, unknown>)
        : {}
  };
}

export async function registerEnquiryRoutes(app: any): Promise<void> {
  // E20-57 AC #1: "on submit -> enqueue job". Creates the Enquiry row and its AOK dispatch
  // job in one transaction, so submitting an enquiry always results in a queued dispatch —
  // closing the gap where dispatch previously only worked against an enquiry that already
  // existed (there was no create-enquiry endpoint anywhere in this repo).
  //
  // NOT implemented: the ticket's "Pre-approval gate -> not routed until approved" AC. There
  // is no enquiry-level approval concept anywhere in this schema — ApprovalRequest only
  // exists for internal seat Bookings (a different, unrelated "Booking" from AOK's), gated
  // by ApprovalRule. Wiring a real pre-approval gate here would mean inventing an
  // Enquiry-approval workflow from scratch, which is out of scope for closing this gap
  // honestly — flagged in docs/architecture/jira-ticket-checklist.md instead of guessed at.
  app.post("/api/v1/enquiries", async (request: any, reply: any) => {
    const body = parseCreateEnquiryPayload(request.body);
    if (!body) {
      return reply.badRequest("Enquiry creation payload is invalid");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const submitter =
        body.mode === "public"
          ? await tx.appUser.findUnique({
              where: { id: body.submittedById },
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            })
          : null;

      const publicContact =
        body.mode === "public"
          ? {
              name:
                typeof body.publicContact.name === "string" && body.publicContact.name.trim().length > 0
                  ? body.publicContact.name.trim()
                  : submitter?.firstName ?? "Unknown",
              surname:
                typeof body.publicContact.surname === "string" && body.publicContact.surname.trim().length > 0
                  ? body.publicContact.surname.trim()
                  : submitter?.lastName ?? "Unknown",
              telephone:
                typeof body.publicContact.telephone === "string" && body.publicContact.telephone.trim().length > 0
                  ? body.publicContact.telephone.trim()
                  : undefined,
              mobile:
                typeof body.publicContact.mobile === "string" && body.publicContact.mobile.trim().length > 0
                  ? body.publicContact.mobile.trim()
                  : undefined,
              email:
                typeof body.publicContact.email === "string" && body.publicContact.email.trim().length > 0
                  ? body.publicContact.email.trim()
                  : submitter?.email ?? undefined,
              position:
                typeof body.publicContact.position === "string" && body.publicContact.position.trim().length > 0
                  ? body.publicContact.position.trim()
                  : undefined,
              additionalInformation:
                typeof body.publicContact.additionalInformation === "string" &&
                body.publicContact.additionalInformation.trim().length > 0
                  ? body.publicContact.additionalInformation.trim()
                  : undefined
            }
          : {};

      const enquiry = await tx.enquiry.create({
        data: {
          id: randomUUID(),
          tenantId: body.tenantId,
          submittedById: body.submittedById,
          enquiryType: body.enquiryType ?? null,
          category: body.category ?? null,
          purpose: body.purpose ?? null,
          title: body.title ?? null,
          preferredDate: body.preferredDate ?? null,
          preferredLocation: body.preferredLocation ?? null,
          budget: body.budget ?? null,
          currency: body.currency ?? loadConfig().ENQUIRY_DEFAULT_CURRENCY,
          taxAmount: body.taxAmount ?? null,
          guestCount: body.guestCount ?? null,
          notes: body.notes ?? null,
          status: "submitted",
          attachmentUrls: body.attachmentUrls,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // dispatchKey = enquiry.id itself — same server-derived idempotency convention as the
      // standalone dispatch endpoint below, guaranteeing "routed exactly once" regardless of
      // what a client sends.
      const dispatch = await tx.enquiryDispatch.create({
        data: {
          id: randomUUID(),
          enquiryId: enquiry.id,
          provider: "aok",
          dispatchKey: enquiry.id,
          targetMode: body.mode,
          targetContactRef: body.contactId ?? null,
          status: "queued",
          attemptCount: 0,
          maxAttempts: 4,
          nextAttemptAt: new Date(),
          payload: {
            enquirySource: body.enquirySource,
            details: body.details,
            publicContact
          }
        }
      });

      return { enquiry, dispatch };
    });

    return reply.code(201).send({
      data: {
        // enquiryId/dispatchId kept for existing callers (SubmitEnquiryDialog.tsx etc).
        // `enquiry` added so a UI can render the full row immediately without a second
        // round-trip to GET /api/v1/enquiries — same optimistic-echo pattern used by
        // POST /api/v1/events.
        enquiryId: result.enquiry.id,
        dispatchId: result.dispatch.id,
        enquiry: result.enquiry
      }
    });
  });

  // List surface for the eventrax-2.0 Enquiries screen (features/enquiries/components/
  // EnquiriesView.tsx), which previously held its seed mock data in local component state
  // only — not even localStorage — so nothing survived a refresh. Filters by tenantId when
  // supplied (no auth/tenant-context middleware exists yet — see the note on
  // parseCreateEnquiryPayload's sibling in event-routes.ts), otherwise returns everything.
  app.get("/api/v1/enquiries", async (request: any, _reply: any) => {
    const tenantId = isUuid(request.query?.tenantId) ? (request.query.tenantId as string) : undefined;

    const enquiries = await prisma.enquiry.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: {
        submittedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        tenant: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    const data = (enquiries as any[]).map((e) => {
      const submitter = e.submittedBy;
      const submittedByName = submitter
        ? [submitter.firstName, submitter.lastName].filter(Boolean).join(" ") || submitter.email
        : null;

      return {
        id: e.id,
        tenantId: e.tenantId,
        tenantName: e.tenant?.name ?? null,
        submittedById: e.submittedById,
        submittedByName,
        submittedByEmail: submitter?.email ?? null,
        enquiryType: e.enquiryType,
        category: e.category,
        purpose: e.purpose,
        title: e.title,
        preferredDate: e.preferredDate,
        preferredLocation: e.preferredLocation,
        budget: e.budget,
        currency: e.currency,
        taxAmount: e.taxAmount,
        guestCount: e.guestCount,
        notes: e.notes,
        status: e.status,
        attachmentUrls: e.attachmentUrls ?? [],
        crmLastSyncAt: e.crmLastSyncAt,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        cancelledAt: e.cancelledAt
      };
    });

    return { data };
  });

  // Enquiry-level cancel — distinct from event-service's /api/v1/events/:id/cancel (E20-55),
  // which cancels a Listing/Booking that already exists. An Enquiry can be cancelled by the
  // requestor before AOK ever spawns a Booking (or while it's still in negotiation); once
  // it's reached one of the mirror's terminal statuses (accepted/closed/cancelled) it's no
  // longer the requestor's to cancel — accepted/closed are AOK-driven outcomes at that point.
  app.post("/api/v1/enquiries/:id/cancel", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Enquiry id must be a UUID");
    }

    const existing = await prisma.enquiry.findUnique({ where: { id } });
    if (!existing) {
      return reply.notFound("Enquiry not found");
    }
    if (existing.status === "cancelled") {
      return { data: existing, alreadyCancelled: true, notified: false };
    }
    if ((ENQUIRY_STATUS_MIRROR_TERMINAL_STATUSES as readonly string[]).includes(existing.status ?? "")) {
      return reply.badRequest(`Cannot cancel an enquiry with status "${existing.status}"`);
    }

    const updated = await prisma.enquiry.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() }
    });

    let notified = false;
    if (existing.submittedById) {
      const result = await dispatchNotification(prisma, {
        tenantId: existing.tenantId ?? "",
        userId: existing.submittedById,
        type: "enquiry.cancelled",
        title: "Your enquiry has been cancelled",
        message: `Enquiry ${existing.title ?? id} has been cancelled.`,
        templateKey: "enquiry-cancelled-requestor",
        idempotencyKey: `enquiry-cancel:${id}`,
        payload: { enquiryId: id }
      });
      notified = result.dispatched;
    }

    app.log.info(
      { audit: true, actor: "booking-service:enquiry-cancel", action: "enquiry.cancelled", enquiryId: id },
      "Enquiry cancelled"
    );

    return { data: updated, notified };
  });

  app.post("/api/v1/enquiries/dispatch", async (request: any, reply: any) => {
    const body = parseDispatchPayload(request.body);
    if (!body) {
      return reply.badRequest("Enquiry dispatch payload is invalid");
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const existing = await tx.enquiryDispatch.findUnique({
        where: { dispatchKey: body.dispatchKey }
      });

      if (existing) {
        return {
          dispatchId: existing.id,
          enquiryId: existing.enquiryId,
          queued: false
        };
      }

      const enquiry = await tx.enquiry.findUnique({
        where: { id: body.enquiryId },
        select: { id: true }
      });

      if (!enquiry) {
        throw reply.notFound("Enquiry not found");
      }

      const dispatch = await tx.enquiryDispatch.create({
        data: {
          id: randomUUID(),
          enquiryId: body.enquiryId,
          provider: "aok",
          dispatchKey: body.dispatchKey,
          targetMode: body.mode,
          targetContactRef: body.contactId ?? null,
          status: "queued",
          attemptCount: 0,
          // Ticket calls for dead-lettering "after 4 failures" — resolveEnquiryRetryState
          // dead-letters once attemptCount + 1 >= maxAttempts, so 4 here means exactly that.
          maxAttempts: 4,
          nextAttemptAt: new Date(),
          payload: {
            enquirySource: body.enquirySource,
            details: body.details,
            publicContact: body.publicContact
          }
        }
      });

      return {
        dispatchId: dispatch.id,
        enquiryId: dispatch.enquiryId,
        queued: true
      };
    });

    return reply.code(result.queued ? 202 : 200).send(result);
  });

  app.get("/api/v1/enquiries/:id/dispatches", async (request: any, reply: any) => {
    const enquiryId = isUuid(request.params.id) ? request.params.id : null;
    if (!enquiryId) {
      return reply.badRequest("Enquiry id must be a UUID");
    }

    const data = await prisma.enquiryDispatch.findMany({
      where: { enquiryId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    return { data };
  });

  // Legacy path — kept running as-is. AOK's actual "Enquiry" webhook receiver URL
  // (configured on their side) is presumed to point here today, unconfirmed. Once it's
  // repointed at POST /api/v1/integration/webhooks/3d/enquiry (E20-53), this can be removed.
  app.post("/api/v1/webhooks/aok/enquiries", async (request: any, reply: any) => {
    const body = parseEnquiryWebhookPayload(request.body);
    if (!body) {
      return reply.badRequest("AOK enquiry webhook payload is invalid");
    }

    const result = await reconcileEnquiryDispatch(prisma, body);

    if (!result.handled) {
      return reply.notFound("Dispatch not found for AOK enquiry");
    }

    return {
      data: result.dispatch
    };
  });
}

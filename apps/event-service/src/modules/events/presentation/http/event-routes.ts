import { randomUUID } from "node:crypto";

import { dispatchNotification, prisma, Prisma } from "@eventrax/database";

// FRD JIRA Epic 2: `EventVisibility.group`/`RequestorGroup` can't be regenerated into
// `@prisma/client`'s types in this environment (no network access to Prisma's engine binary
// CDN — see the jira checklist's E20-55 note). Same `db` escape hatch as publishing-routes.ts.
const db = prisma as any;

/**
 * E20-55: Listing Update + Cascade Notifications. There is no "Listing" or "GuestInvite"
 * model in this schema (the ticket's terms) — "Event" and "Invitation" are the real
 * equivalents, and there was no PATCH/cancel endpoint anywhere in this repo at all
 * (event-service's module scaffold was entirely empty; "S2-02 Listing CRUD" doesn't exist as
 * a real prior ticket). This builds the minimal PATCH/cancel surface needed to support the
 * cascade-notification behaviour the ticket actually asks for, not a full CRUD API.
 */
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function getTrustedIdentity(request: any): { userId?: string; tenantId?: string } {
  const userId = isUuid(request.headers?.["x-etx-user-id"]) ? (request.headers["x-etx-user-id"] as string) : undefined;
  const tenantId = isUuid(request.headers?.["x-etx-tenant-id"])
    ? (request.headers["x-etx-tenant-id"] as string)
    : undefined;

  return { userId, tenantId };
}

// Material per the ticket: date, venue, time. Cosmetic (title/description) changes must NOT
// trigger re-confirmation.
const MATERIAL_FIELDS = ["startDate", "endDate", "venueId"] as const;
type MaterialField = (typeof MATERIAL_FIELDS)[number];

function parsePatchPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  const patch: {
    title?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    venueId?: string;
  } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") return null;
    patch.title = body.title;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") return null;
    patch.description = body.description;
  }
  if (body.startDate !== undefined) {
    const parsed = new Date(body.startDate as string);
    if (Number.isNaN(parsed.getTime())) return null;
    patch.startDate = parsed;
  }
  if (body.endDate !== undefined) {
    const parsed = new Date(body.endDate as string);
    if (Number.isNaN(parsed.getTime())) return null;
    patch.endDate = parsed;
  }
  if (body.venueId !== undefined) {
    if (!isUuid(body.venueId)) return null;
    patch.venueId = body.venueId;
  }

  return patch;
}

function valuesDiffer(a: unknown, b: unknown): boolean {
  const aTime = a instanceof Date ? a.getTime() : a;
  const bTime = b instanceof Date ? b.getTime() : b;
  return aTime !== bTime;
}

// Accept trusted identity from api-gateway when present, but keep the payload-based fallback so
// existing local/dev flows keep working until every caller is routed through the gateway.
function parseCreateEventPayload(value: unknown, identity?: { userId?: string; tenantId?: string }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const body = value as Record<string, unknown>;
  // "Save draft" from the wizard: persist a partially-filled Listing. When isDraft is true, every
  // field except tenant/creator is optional; a normal (publish) create keeps its strict contract.
  const isDraft = body.isDraft === true;
  const tenantId = identity?.tenantId ?? (isUuid(body.tenantId) ? (body.tenantId as string) : undefined);
  const createdBy = identity?.userId ?? (isUuid(body.createdBy) ? (body.createdBy as string) : undefined);
  if (!tenantId || !createdBy) {
    return null;
  }

  const hasTitle = typeof body.title === "string" && body.title.trim().length > 0;
  const hasEventType = typeof body.eventType === "string" && body.eventType.length > 0;
  const hasVenue = typeof body.venueName === "string" && (body.venueName as string).trim().length > 0;

  // A non-draft Listing must carry its core fields; a draft may be missing any of them.
  if (!isDraft && (!hasTitle || !hasEventType || !hasVenue)) {
    return null;
  }

  const parseOptionalDate = (raw: unknown): Date | undefined | null => {
    if (raw === undefined || raw === null || raw === "") return undefined;
    const parsed = new Date(raw as string);
    if (Number.isNaN(parsed.getTime())) return null; // sentinel: present but invalid
    return parsed;
  };

  const startDate = parseOptionalDate(body.startDate);
  if (startDate === null) return null; // invalid date string, never valid even for a draft
  if (!isDraft && !startDate) return null;

  const endDate = parseOptionalDate(body.endDate);
  if (endDate === null) return null;

  const bookingDeadline = parseOptionalDate(body.bookingDeadline);
  if (bookingDeadline === null) return null;

  let capacity: number | undefined;
  if (body.capacity !== undefined && body.capacity !== null && body.capacity !== "") {
    const parsed = Number(body.capacity);
    if (Number.isFinite(parsed) && parsed > 0) capacity = parsed;
    else if (!isDraft) return null;
  } else if (!isDraft) {
    return null;
  }

  return {
    // When present, targets an existing draft to promote/update in place rather than insert a new
    // row (so save-draft -> re-save -> publish all mutate the same row). Ignored if not a UUID.
    id: isUuid(body.id) ? (body.id as string) : undefined,
    tenantId,
    createdBy,
    isDraft,
    // Give a draft a placeholder title so it's identifiable in the Drafts list even if the CEM
    // hasn't typed a name yet; a non-draft always has a real title by the check above.
    title: hasTitle ? (body.title as string).trim() : "Untitled event",
    description: typeof body.description === "string" ? body.description : undefined,
    eventType: hasEventType ? (body.eventType as string) : undefined,
    // FRD JIRA Epic 1, Story 1.1: a non-draft Listing enters a pending-review state, invisible to
    // employees until separately published. A draft carries status "draft" (and is additionally
    // hidden by is_draft), so it never leaks into any requester- or listing-facing query.
    status: isDraft
      ? "draft"
      : typeof body.status === "string" && body.status.length > 0
        ? body.status
        : "pending_review",
    venueName: hasVenue ? (body.venueName as string).trim() : undefined,
    categoryName:
      typeof body.categoryName === "string" && body.categoryName.trim().length > 0
        ? body.categoryName.trim()
        : undefined,
    startDate: startDate ?? undefined,
    endDate: endDate ?? undefined,
    bookingDeadline: bookingDeadline ?? undefined,
    isInvitationOnly: typeof body.isInvitationOnly === "boolean" ? body.isInvitationOnly : false,
    isMultiDate: typeof body.isMultiDate === "boolean" ? body.isMultiDate : false,
    supplier: typeof body.supplier === "string" ? body.supplier : undefined,
    dressCode: typeof body.dressCode === "string" ? body.dressCode : undefined,
    inclusions: typeof body.inclusions === "string" ? body.inclusions : undefined,
    // Wizard uploads are in-browser blob: URLs today — there's no media upload/storage
    // endpoint in this repo, so this is stored as an opaque string and will not resolve for
    // anyone but the browser tab that created it. Flagging rather than building a media
    // service, which is out of scope here.
    thumbnailUrl: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : undefined,
    capacity,
    // Full wizard form, stored verbatim for a draft so Resume is lossless. Ignored for a
    // non-draft create (a published Listing's state lives entirely in its own columns).
    draftPayload:
      isDraft && body.draftPayload && typeof body.draftPayload === "object" && !Array.isArray(body.draftPayload)
        ? (body.draftPayload as Record<string, unknown>)
        : undefined,
    source: resolveEventSource(body)
  };
}

const EVENT_SOURCES = ["aok-sourced", "enquiry-originated", "company-sourced"] as const;
type EventSource = (typeof EVENT_SOURCES)[number];

// FRD JIRA Epic 1, Story 1.4: auto-tag, never a free-typed field a caller can override at
// will. `sourceEnquiryId` isn't wired to any UI yet (Story 1.7 — "link a Listing to its
// originating Enquiry" — is explicitly out of scope for this pass), but the plumbing is
// honest to have ready rather than guessed at later: if a caller ever does pass it, this is
// unambiguously an enquiry-originated listing regardless of what else is in the payload.
// Otherwise, `company-sourced` is the correct default because it's the *only* creation path
// that exists anywhere in this repo today (the CEM Create Event wizard, i.e. Story 1.5's
// "company self-upload") — there is no separate AOK-side upload flow yet to ever produce
// `aok-sourced` for real, even though the value is supported here.
function resolveEventSource(body: Record<string, unknown>): EventSource {
  if (isUuid(body.sourceEnquiryId)) return "enquiry-originated";
  if (typeof body.source === "string" && (EVENT_SOURCES as readonly string[]).includes(body.source)) {
    return body.source as EventSource;
  }
  return "company-sourced";
}

function serializeEvent(event: any) {
  const capacity = (event.inventoryItems ?? []).reduce(
    (sum: number, item: any) => sum + (item.totalSeats ?? 0),
    0
  );
  const booked = (event.bookings ?? [])
    .filter((b: any) => b.status === "confirmed" || b.status === "completed")
    .reduce((sum: number, b: any) => sum + (b.seatsRequested ?? 0), 0);
  const waitlist = (event.bookings ?? [])
    .filter((b: any) => b.waitlistPosition !== null && b.waitlistPosition !== undefined)
    .reduce((sum: number, b: any) => sum + (b.seatsRequested ?? 0), 0);

  return {
    id: event.id,
    tenantId: event.tenantId,
    title: event.title,
    description: event.description,
    eventType: event.eventType,
    status: event.status,
    isDraft: event.isDraft ?? false,
    draftPayload: event.draftPayload ?? null,
    startDate: event.startDate,
    endDate: event.endDate,
    venueId: event.venueId,
    venueName: event.venue?.name ?? null,
    categoryId: event.categoryId,
    categoryName: event.category?.name ?? null,
    dressCode: event.dressCode,
    inclusions: event.inclusions,
    bookingDeadline: event.bookingDeadline,
    thumbnailUrl: event.thumbnailUrl,
    source: event.source,
    isPublished: event.isPublished ?? false,
    publishedAt: event.publishedAt,
    forcePublished: event.forcePublished ?? false,
    visibleGroups: (event.visibilities ?? [])
      .filter((v: any) => v.group)
      .map((v: any) => ({ id: v.group.id, name: v.group.name, isRestricted: v.group.isRestricted })),
    capacity,
    booked,
    waitlist,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt
  };
}

type EventAuditRow = {
  id: string;
  tenantId: string | null;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | string | null;
};

async function cascadeMaterialChange(
  app: any,
  event: { id: string; tenantId: string | null; title: string | null },
  changeSummary: Record<string, unknown>
): Promise<number> {
  const changeFingerprint = JSON.stringify(changeSummary);
  const bookings = await prisma.booking.findMany({
    where: { eventId: event.id },
    include: { invitations: true }
  });

  let notified = 0;
  const tenantId = event.tenantId ?? "";

  for (const booking of bookings as any[]) {
    if (booking.requesterId) {
      const result = await dispatchNotification(prisma, {
        tenantId,
        userId: booking.requesterId,
        type: "listing.updated",
        title: "Your event has been updated",
        message: `The event "${event.title ?? event.id}" has changed.`,
        templateKey: "listing-updated-requestor",
        idempotencyKey: `listing-update:${event.id}:${booking.id}:requester:${changeFingerprint}`,
        payload: changeSummary
      });
      if (result.dispatched) notified += 1;
    }

    for (const invitation of booking.invitations ?? []) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { needsReconfirmation: true, status: "pending_reconfirmation" }
      });

      if (invitation.guestId) {
        const guest = await prisma.guest.findUnique({ where: { id: invitation.guestId } });
        if (guest?.email) {
          const result = await dispatchNotification(prisma, {
            tenantId,
            email: guest.email,
            type: "listing.updated",
            title: "Please re-confirm your attendance",
            message: `The event "${event.title ?? event.id}" has changed — please re-confirm your attendance.`,
            templateKey: "listing-updated-guest",
            idempotencyKey: `listing-update:${event.id}:invitation:${invitation.id}:${changeFingerprint}`,
            payload: changeSummary
          });
          if (result.dispatched) notified += 1;
        }
      }
    }
  }

  app.log.info(
    {
      audit: true,
      actor: "event-service:listing-update",
      action: "listing.material_change",
      eventId: event.id,
      changeSummary,
      notified
    },
    "Listing material change cascaded"
  );

  return notified;
}

// Venue/EventCategory have no tenant_id column (shared reference data across tenants), so this is
// a find-by-name-or-create rather than a tenant-scoped lookup. The wizard only ever sends free
// text for both, never an existing id. A draft may carry neither, so each is skipped when absent
// (venueId/categoryId then resolve to null on the row). Shared by the create and update paths.
async function resolveVenueAndCategory(
  tx: any,
  body: { venueName?: string; categoryName?: string; capacity?: number }
): Promise<{ venue: any; category: any }> {
  let venue: any = null;
  if (body.venueName) {
    venue = await tx.venue.findFirst({ where: { name: body.venueName } });
    if (!venue) {
      venue = await tx.venue.create({
        data: {
          id: randomUUID(),
          name: body.venueName,
          capacity: body.capacity ?? null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
  }

  let category: any = null;
  if (body.categoryName) {
    category = await tx.eventCategory.findFirst({ where: { name: body.categoryName } });
    if (!category) {
      category = await tx.eventCategory.create({
        data: { id: randomUUID(), name: body.categoryName, createdAt: new Date() }
      });
    }
  }

  return { venue, category };
}

// Create or update the single InventoryItem that holds a Listing's seat allocation (Event has no
// capacity column of its own). A draft with no capacity yet has no inventory row; one is created
// when capacity first appears, and updated in place thereafter. Safe to reset availableSeats to
// capacity here because this path only ever runs for drafts (which have no bookings).
async function upsertInventory(tx: any, eventId: string, capacity: number | undefined): Promise<any> {
  if (capacity === undefined) {
    return tx.inventoryItem.findFirst({ where: { eventId } });
  }
  const existing = await tx.inventoryItem.findFirst({ where: { eventId } });
  if (existing) {
    return tx.inventoryItem.update({
      where: { id: existing.id },
      data: { totalSeats: capacity, availableSeats: capacity, updatedAt: new Date() }
    });
  }
  return tx.inventoryItem.create({
    data: {
      id: randomUUID(),
      eventId,
      // package_type enum (standard|vip|premium|corporate|group); "standard" is the base tier.
      packageType: "standard",
      totalSeats: capacity,
      availableSeats: capacity,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
}

export async function registerEventRoutes(app: any): Promise<void> {
  // S2-02 Listing CRUD — flagged as missing under E20-55's "Pending" section
  // (docs/architecture/jira-ticket-checklist.md): this service had a PATCH/cancel surface but
  // no way to create a Listing/Event or list them at all, so the eventrax-2.0 Listing page had
  // nothing persisted to read from (it was rendering static mock data plus a
  // localStorage-only "created events" cache — see src/lib/createdEvents.ts).
  app.post("/api/v1/events", async (request: any, reply: any) => {
    const body = parseCreateEventPayload(request.body, getTrustedIdentity(request));
    if (!body) {
      return reply.badRequest("Event creation payload is invalid");
    }

    // Promote/update in place when the payload targets an existing draft (save-draft -> re-save ->
    // publish all mutate the SAME row). Only a draft may be updated here; a real Listing is off
    // limits (it uses PATCH/publish/cancel). A stale id (row already gone) falls through to create.
    const existing = body.id ? await prisma.event.findUnique({ where: { id: body.id } }) : null;
    if (existing && !existing.isDraft) {
      return reply.badRequest("Only draft listings can be updated via this endpoint");
    }

    // draftPayload is stored only while the row is a draft; promoting to a real Listing clears it.
    // Prisma.DbNull sets the nullable Json column to SQL NULL — a plain `null` would instead store
    // the JSON value `null` and leave `draft_payload IS NULL` false.
    const draftPayloadWrite: any =
      body.isDraft && body.draftPayload ? body.draftPayload : Prisma.DbNull;

    if (existing) {
      const result = await prisma.$transaction(async (tx: any) => {
        const { venue, category } = await resolveVenueAndCategory(tx, body);
        const event = await tx.event.update({
          where: { id: existing.id },
          data: {
            categoryId: category?.id ?? null,
            venueId: venue?.id ?? null,
            title: body.title,
            description: body.description ?? null,
            eventType: body.eventType ?? null,
            status: body.status,
            isDraft: body.isDraft,
            draftPayload: draftPayloadWrite,
            startDate: body.startDate ?? null,
            endDate: body.endDate ?? body.startDate ?? null,
            isInvitationOnly: body.isInvitationOnly,
            isMultiDate: body.isMultiDate,
            supplier: body.supplier ?? null,
            dressCode: body.dressCode ?? null,
            inclusions: body.inclusions ?? null,
            bookingDeadline: body.bookingDeadline ?? null,
            thumbnailUrl: body.thumbnailUrl ?? null,
            updatedAt: new Date()
          }
        });
        const inventoryItem = await upsertInventory(tx, existing.id, body.capacity);
        return { event, venue, category, inventoryItem };
      });

      app.log.info(
        {
          audit: true,
          actor: "event-service:listing-update",
          action: body.isDraft ? "listing.draft_updated" : "listing.draft_promoted",
          eventId: result.event.id,
          tenantId: result.event.tenantId
        },
        body.isDraft ? "Draft updated" : "Draft promoted to listing"
      );

      return reply.code(200).send({
        data: {
          ...result.event,
          venueName: result.venue?.name ?? null,
          categoryName: result.category?.name ?? null,
          capacity: result.inventoryItem?.totalSeats ?? 0,
          availableSeats: result.inventoryItem?.availableSeats ?? 0,
          booked: 0,
          waitlist: 0
        }
      });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const { venue, category } = await resolveVenueAndCategory(tx, body);
      const event = await tx.event.create({
        data: {
          id: randomUUID(),
          tenantId: body.tenantId,
          categoryId: category?.id ?? null,
          venueId: venue?.id ?? null,
          title: body.title,
          description: body.description ?? null,
          eventType: body.eventType ?? null,
          status: body.status,
          isDraft: body.isDraft,
          draftPayload: draftPayloadWrite,
          startDate: body.startDate ?? null,
          // The create form captures a single date (no end-date field). For a real event default
          // the end to the start; a draft may have neither yet, so this is left null in that case.
          endDate: body.endDate ?? body.startDate ?? null,
          isInvitationOnly: body.isInvitationOnly,
          isMultiDate: body.isMultiDate,
          supplier: body.supplier ?? null,
          dressCode: body.dressCode ?? null,
          inclusions: body.inclusions ?? null,
          bookingDeadline: body.bookingDeadline ?? null,
          thumbnailUrl: body.thumbnailUrl ?? null,
          source: body.source,
          createdBy: body.createdBy,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      const inventoryItem = await upsertInventory(tx, event.id, body.capacity);
      return { event, venue, category, inventoryItem };
    });

    app.log.info(
      {
        audit: true,
        actor: "event-service:listing-create",
        action: "listing.created",
        eventId: result.event.id,
        tenantId: result.event.tenantId
      },
      "Event created"
    );

    return reply.code(201).send({
      data: {
        ...result.event,
        venueName: result.venue?.name ?? null,
        categoryName: result.category?.name ?? null,
        capacity: result.inventoryItem?.totalSeats ?? 0,
        availableSeats: result.inventoryItem?.availableSeats ?? 0,
        booked: 0,
        waitlist: 0
      }
    });
  });

  // List surface for the Listing page. Filters by tenantId when supplied (no auth middleware
  // resolves this yet — see the note on parseCreateEventPayload), otherwise returns everything.
  // Drafts (is_draft=true) are excluded by default; pass ?draft=true to fetch ONLY drafts (the
  // Drafts view). Either way a Listing is never mixed with drafts in the same response.
  app.get("/api/v1/events", async (request: any, _reply: any) => {
    const identity = getTrustedIdentity(request);
    const tenantId = isUuid(request.query?.tenantId)
      ? (request.query.tenantId as string)
      : identity.tenantId;
    const wantDrafts = request.query?.draft === "true" || request.query?.draft === true;

    const events = await db.event.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        isDraft: wantDrafts
      },
      include: {
        venue: true,
        category: true,
        inventoryItems: true,
        bookings: { select: { status: true, seatsRequested: true, waitlistPosition: true } },
        // FRD JIRA Epic 2, Story 2.1: group-targeted visibility rows, so the list response can
        // report which Requestor Groups a Listing is currently published to.
        visibilities: { where: { groupId: { not: null } }, include: { group: true } }
      },
      orderBy: { startDate: "asc" }
    });

    const data = (events as any[]).map(serializeEvent);

    return { data };
  });

  app.get("/api/v1/events/:id", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const identity = getTrustedIdentity(request);
    const tenantId = isUuid(request.query?.tenantId)
      ? (request.query.tenantId as string)
      : identity.tenantId;

    const event = await db.event.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        venue: true,
        category: true,
        inventoryItems: true,
        bookings: { select: { status: true, seatsRequested: true, waitlistPosition: true } },
        visibilities: { where: { groupId: { not: null } }, include: { group: true } }
      }
    });

    if (!event) {
      return reply.notFound("Event not found");
    }

    return { data: serializeEvent(event) };
  });

  app.get("/api/v1/events/:id/audit", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const identity = getTrustedIdentity(request);
    const tenantId = isUuid(request.query?.tenantId)
      ? (request.query.tenantId as string)
      : identity.tenantId;

    const event = await db.event.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      select: { id: true }
    });

    if (!event) {
      return reply.notFound("Event not found");
    }

    const rows = (await db.$queryRaw`
      SELECT
        a.id,
        a.tenant_id AS "tenantId",
        a.actor AS "actorId",
        COALESCE(
          NULLIF(TRIM(COALESCE(actor_user.first_name, '') || ' ' || COALESCE(actor_user.last_name, '')), ''),
          actor_user.email,
          a.actor
        ) AS "actorName",
        a.action,
        a.entity_type AS "entityType",
        a.entity_id AS "entityId",
        a.metadata,
        a.created_at AS "createdAt"
      FROM audit_log a
      LEFT JOIN app_user actor_user
        ON a.actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND actor_user.id = a.actor::uuid
      WHERE
        (a.entity_type = 'event' AND a.entity_id = ${id})
        OR
        (a.entity_type = 'booking' AND a.metadata->>'eventId' = ${id})
      ORDER BY a.created_at DESC, a.id DESC
    `) as EventAuditRow[];

    return { data: rows };
  });

  app.patch("/api/v1/events/:id", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const patch = parsePatchPayload(request.body);
    if (!patch) {
      return reply.badRequest("Event update payload is invalid");
    }

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return reply.notFound("Event not found");
    }
    if (existing.status === "cancelled") {
      return reply.badRequest("Cannot update a cancelled event");
    }

    const isMaterial = MATERIAL_FIELDS.some(
      (field: MaterialField) => patch[field] !== undefined && valuesDiffer(patch[field], (existing as any)[field])
    );

    const updated = await prisma.event.update({
      where: { id },
      data: { ...patch, updatedAt: new Date() }
    });

    if (!isMaterial) {
      return { data: updated, materialChange: false };
    }

    const changeSummary = {
      startDate: patch.startDate ? patch.startDate.toISOString() : null,
      endDate: patch.endDate ? patch.endDate.toISOString() : null,
      venueId: patch.venueId ?? null
    };

    const notified = await cascadeMaterialChange(app, existing, changeSummary);

    return { data: updated, materialChange: true, notified };
  });

  // Delete a draft Listing. Deliberately restricted to drafts (is_draft=true): a real
  // published/live Listing is never hard-deleted (it uses the cancel flow below), so this can
  // only ever remove a draft. Drafts carry no bookings, so clearing any inventory/visibility
  // rows and the event row is safe. Used by the Drafts view's delete and by draft re-save
  // (delete-then-recreate) so re-saving never accumulates duplicate draft rows.
  app.delete("/api/v1/events/:id", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return reply.notFound("Event not found");
    }
    if (!existing.isDraft) {
      return reply.badRequest("Only draft listings can be deleted");
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.eventVisibility.deleteMany({ where: { eventId: id } });
      await tx.inventoryItem.deleteMany({ where: { eventId: id } });
      await tx.event.delete({ where: { id } });
    });

    app.log.info(
      {
        audit: true,
        actor: "event-service:draft-delete",
        action: "listing.draft_deleted",
        eventId: id,
        tenantId: existing.tenantId
      },
      "Draft deleted"
    );

    return reply.code(204).send();
  });

  app.post("/api/v1/events/:id/cancel", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return reply.notFound("Event not found");
    }
    if (existing.status === "cancelled") {
      return { data: existing, alreadyCancelled: true, notified: 0 };
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { status: "cancelled", updatedAt: new Date() }
    });

    const bookings = await prisma.booking.findMany({
      where: { eventId: id },
      include: { invitations: true }
    });

    let notified = 0;
    const tenantId = existing.tenantId ?? "";

    for (const booking of bookings as any[]) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled" }
      });

      if (booking.inventoryItemId && typeof booking.seatsRequested === "number") {
        await prisma.inventoryItem.update({
          where: { id: booking.inventoryItemId },
          data: { availableSeats: { increment: booking.seatsRequested } }
        });
      }

      if (booking.requesterId) {
        const result = await dispatchNotification(prisma, {
          tenantId,
          userId: booking.requesterId,
          type: "listing.cancelled",
          title: "Your event has been cancelled",
          message: `The event "${existing.title ?? id}" has been cancelled.`,
          templateKey: "listing-cancelled-requestor",
          idempotencyKey: `listing-cancel:${id}:${booking.id}:requester`,
          payload: { eventId: id }
        });
        if (result.dispatched) notified += 1;
      }

      for (const invitation of booking.invitations ?? []) {
        if (invitation.guestId) {
          const guest = await prisma.guest.findUnique({ where: { id: invitation.guestId } });
          if (guest?.email) {
            const result = await dispatchNotification(prisma, {
              tenantId,
              email: guest.email,
              type: "listing.cancelled",
              title: "Event cancelled",
              message: `The event "${existing.title ?? id}" has been cancelled.`,
              templateKey: "listing-cancelled-guest",
              idempotencyKey: `listing-cancel:${id}:invitation:${invitation.id}`,
              payload: { eventId: id }
            });
            if (result.dispatched) notified += 1;
          }
        }
      }

      app.log.info(
        {
          audit: true,
          actor: "event-service:listing-cancel",
          action: "booking.cancelled_by_listing",
          bookingId: booking.id,
          eventId: id
        },
        "Booking cancelled due to listing cancellation"
      );
    }

    return { data: updated, notified };
  });
}

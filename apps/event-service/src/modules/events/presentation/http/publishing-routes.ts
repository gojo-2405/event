import { randomUUID } from "node:crypto";

import { prisma } from "@eventrax/database";

// `RequestorGroup`/`RequestorGroupMember` and the new `Event`/`EventVisibility` columns
// (publishedAt, groupId, etc. — requestor-groups-and-publishing-foundation.sql) can't be
// regenerated into `@prisma/client`'s types in this environment (no network access to Prisma's
// engine binary CDN — see the jira checklist's E20-55 note for the same limitation). `db` is
// the same escape hatch already used for `tx: any` elsewhere in this repo's route files.
const db = prisma as any;

/**
 * FRD JIRA Epic 2: Publishing & Visibility Targeting.
 *
 * Stories built here:
 *  - 2.1 Publish a Listing to one or more Requestor Groups (required; defaults to "All
 *    Employees" if none are chosen)
 *  - 2.2 Unpublish a Listing without deleting it or affecting bookings
 *  - 2.3 AOK force-publish (same publish action, `forcedByAok: true`, distinctly audit-flagged)
 *  - 2.5 Expand visibility on an already-published Listing by adding groups, without an
 *    unpublish/republish round-trip
 *
 * Not built here (tracked separately in the jira checklist): 2.4/2.6/2.7 underperformance
 * flagging + notify-AOK + VIP exclusion — a separable feature that needs a threshold/scheduler
 * mechanism this pass doesn't touch. `RequestorGroup.isRestricted` and
 * `Event.underperformanceFlagOverride` already exist so 2.7 has somewhere to plug in later.
 *
 * Same posture as event-routes.ts on auth: no auth/tenant-context middleware resolves an actor
 * or tenant from a session yet (E20-20 still pending), so callers pass `tenantId`/`actorId`
 * directly in the payload.
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

function isUuidArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((v) => isUuid(v));
}

const ALL_EMPLOYEES_GROUP_NAME = "All Employees";

// Story 2.1: "If none is chosen, default to 'All Employees'." Every tenant needs exactly one of
// these; find-or-create rather than requiring it to be seeded some other way.
async function resolveDefaultGroup(tx: any, tenantId: string | null) {
  let group = await tx.requestorGroup.findFirst({
    where: { tenantId, name: ALL_EMPLOYEES_GROUP_NAME }
  });
  if (!group) {
    group = await tx.requestorGroup.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: ALL_EMPLOYEES_GROUP_NAME,
        isRestricted: false,
        createdAt: new Date()
      }
    });
  }
  return group;
}

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
      entityType: "event",
      entityId: params.entityId,
      metadata: params.metadata,
      createdAt: new Date()
    }
  });
}

export async function registerPublishingRoutes(app: any): Promise<void> {
  // Story 2.1 (list) — lets the frontend's publish dialog offer real groups to pick from,
  // auto-seeding "All Employees" per tenant on first read so the list is never empty.
  app.get("/api/v1/requestor-groups", async (request: any, reply: any) => {
    const identity = getTrustedIdentity(request);
    const tenantId = isUuid(request.query?.tenantId)
      ? (request.query.tenantId as string)
      : identity.tenantId ?? null;
    if (!tenantId) {
      return reply.badRequest("tenantId query parameter is required");
    }

    await resolveDefaultGroup(db, tenantId);

    const groups = await db.requestorGroup.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" }
    });

    return { data: groups };
  });

  // Story 2.1 (create) — for setting up additional named audiences beyond "All Employees".
  app.post("/api/v1/requestor-groups", async (request: any, reply: any) => {
    const body = request.body as Record<string, unknown> | undefined;
    if (
      !body ||
      !isUuid(body.tenantId) ||
      typeof body.name !== "string" ||
      body.name.trim().length === 0
    ) {
      return reply.badRequest("tenantId and name are required");
    }

    const group = await db.requestorGroup.create({
      data: {
        id: randomUUID(),
        tenantId: body.tenantId,
        name: body.name.trim(),
        isRestricted: typeof body.isRestricted === "boolean" ? body.isRestricted : false,
        createdAt: new Date()
      }
    });

    return reply.code(201).send({ data: group });
  });

  // Stories 2.1 + 2.3: publish (or force-publish, when `forcedByAok: true`) a Listing to one or
  // more Requestor Groups. Republishing (e.g. after an unpublish) replaces the prior group set
  // rather than appending to it — Story 2.5's "add without unpublish/republish" is the separate
  // additive action below.
  app.post("/api/v1/events/:id/publish", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const identity = getTrustedIdentity(request);
    const groupIds = isUuidArray(body.groupIds) ? (body.groupIds as string[]) : null;
    const forcedByAok = body.forcedByAok === true;
    const actorId = identity.userId ?? (isUuid(body.actorId) ? (body.actorId as string) : "unknown");

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return reply.notFound("Event not found");
    }
    if (existing.status === "cancelled") {
      return reply.badRequest("Cannot publish a cancelled event");
    }

    const result = await db.$transaction(async (tx: any) => {
      let groups = groupIds
        ? await tx.requestorGroup.findMany({ where: { id: { in: groupIds }, tenantId: existing.tenantId } })
        : [];

      // Story 2.1: "Given no group is selected, then the system defaults to 'All Employees'
      // rather than blocking or leaving it ungrouped." Also covers the case where every
      // supplied id was invalid/cross-tenant and resolved to nothing.
      if (groups.length === 0) {
        groups = [await resolveDefaultGroup(tx, existing.tenantId)];
      }

      // Replace the prior group-targeting set. Existing per-user visibility rows (groupId
      // null) are untouched — this only owns the group-based rows this feature introduces.
      await tx.eventVisibility.deleteMany({ where: { eventId: id, groupId: { not: null } } });
      await tx.eventVisibility.createMany({
        data: groups.map((group: any) => ({
          id: randomUUID(),
          eventId: id,
          groupId: group.id,
          createdAt: new Date()
        }))
      });

      const updated = await tx.event.update({
        where: { id },
        data: {
          // A published listing can no longer sit in pending-review; booking-derived statuses
          // (available/partial/full/waitlisted) are left as-is if already set.
          status: existing.status === "pending_review" ? "available" : existing.status,
          isPublished: true,
          publishedAt: new Date(),
          unpublishedAt: null,
          forcePublished: forcedByAok,
          updatedAt: new Date()
        }
      });

      return { updated, groups };
    });

    await writeAudit({
      tenantId: existing.tenantId,
      actor: actorId,
      // Story 2.3: "the audit trail clearly distinguishes it from a standard company-side
      // publish" — a distinct action string, not just a boolean buried in metadata.
      action: forcedByAok ? "listing.force_published" : "listing.published",
      entityId: id,
      metadata: { groupIds: result.groups.map((g: any) => g.id), groupNames: result.groups.map((g: any) => g.name), forcedByAok }
    });

    return {
      data: result.updated,
      groups: result.groups.map((g: any) => ({ id: g.id, name: g.name, isRestricted: g.isRestricted }))
    };
  });

  // Story 2.2: unpublish — removes visibility on browse/discovery screens without touching
  // bookings, requests, waitlist entries, or the group-targeting rows themselves (so a later
  // republish restores exactly what was there before, with no data loss).
  app.post("/api/v1/events/:id/unpublish", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const identity = getTrustedIdentity(request);
    const actorId = identity.userId ?? (isUuid(body.actorId) ? (body.actorId as string) : "unknown");

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return reply.notFound("Event not found");
    }
    if (!existing.publishedAt) {
      return { data: existing, alreadyUnpublished: true };
    }

    const updated = await db.event.update({
      where: { id },
      data: { isPublished: false, publishedAt: null, unpublishedAt: new Date(), updatedAt: new Date() }
    });

    await writeAudit({
      tenantId: existing.tenantId,
      actor: actorId,
      action: "listing.unpublished",
      entityId: id,
      metadata: {}
    });

    return { data: updated };
  });

  // Story 2.5: add Requestor Groups to an already-published Listing without an
  // unpublish/republish round-trip. Existing group visibility is preserved (additive, not a
  // replace like the publish action above).
  app.post("/api/v1/events/:id/visibility/groups", async (request: any, reply: any) => {
    const id = isUuid(request.params.id) ? request.params.id : null;
    if (!id) {
      return reply.badRequest("Event id must be a UUID");
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const identity = getTrustedIdentity(request);
    if (!isUuidArray(body.groupIds)) {
      return reply.badRequest("groupIds must be a non-empty array of UUIDs");
    }
    const actorId = identity.userId ?? (isUuid(body.actorId) ? (body.actorId as string) : "unknown");

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return reply.notFound("Event not found");
    }
    if (!existing.publishedAt) {
      return reply.badRequest("Cannot expand visibility on a Listing that isn't published — use /publish instead");
    }

    const groups = await db.requestorGroup.findMany({
      where: { id: { in: body.groupIds as string[] }, tenantId: existing.tenantId }
    });
    if (groups.length === 0) {
      return reply.badRequest("No matching Requestor Groups found for this tenant");
    }

    const alreadyTargeted = await db.eventVisibility.findMany({
      where: { eventId: id, groupId: { in: groups.map((g: any) => g.id) } }
    });
    const alreadyTargetedIds = new Set(alreadyTargeted.map((v: any) => v.groupId));
    const newGroups = groups.filter((g: any) => !alreadyTargetedIds.has(g.id));

    if (newGroups.length > 0) {
      await db.eventVisibility.createMany({
        data: newGroups.map((group: any) => ({
          id: randomUUID(),
          eventId: id,
          groupId: group.id,
          createdAt: new Date()
        }))
      });
    }

    await writeAudit({
      tenantId: existing.tenantId,
      actor: actorId,
      action: "listing.visibility_expanded",
      entityId: id,
      metadata: { addedGroupIds: newGroups.map((g: any) => g.id), addedGroupNames: newGroups.map((g: any) => g.name) }
    });

    const allVisibleGroups = await db.requestorGroup.findMany({
      where: { visibilities: { some: { eventId: id } } }
    });

    return { data: allVisibleGroups.map((g: any) => ({ id: g.id, name: g.name, isRestricted: g.isRestricted })) };
  });
}

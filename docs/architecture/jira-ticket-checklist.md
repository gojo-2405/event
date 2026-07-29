# Jira Ticket Checklist

Project: `E20` Eventrax 2.0  
Tickets in focus:

- `E20-18` RBAC architecture + role matrix
- `E20-19` Permission system + tenant isolation
- `E20-20` Auth middleware (JWT/SSO + role context)
- `E20-21` Notification engine
- `E20-22` Audit trail component
- `E20-17` AOK / 3D API integration flows
- `E20-53` 3D webhook receiver (Flows 9-13) + retry logic
- `E20-57` Enquiry routing to 3D
- `E20-58` Enquiry status updates (mirror from 3D)
- `E20-55` Listing update + cascade notifications
- `E20-59` GDPR data retention + purge

## E20-20

### Completed

- [x] `auth-service` Fastify service scaffold created
- [x] `/api/v1/{service-name}/health` endpoint added
- [x] `/api/v1/auth/me` endpoint added
- [x] `/api/v1/auth/login` endpoint added
- [x] `/api/v1/auth/callback` internal callback flow scaffold added
- [x] `/api/v1/auth/token` local token issuance endpoint added
- [x] bearer token verification scaffold added
- [x] invalid bearer token path normalized toward `401`
- [x] session claims structure added: `sub`, `tenantId`, `role`, `permissions`, `email`
- [x] local debug auth fallback added for development
- [x] local `.env.local` loading automated
- [x] authenticated route helper added and applied to protected routes
- [x] provider abstraction added for future WorkOS integration
- [x] callback service contract added
- [x] identity resolution repository contract added
- [x] mock callback flow added for local testing
- [x] integration tests added for callback success/failure paths

### Pending

- [ ] real WorkOS authorization code exchange
- [ ] WorkOS profile to tenant mapping
- [ ] WorkOS profile to role mapping
- [ ] persistent session/login lifecycle
- [ ] logout/session revocation flow
- [ ] proper secured-route middleware enforcement across all actual protected endpoints
- [ ] automated tests for valid, missing, expired, and invalid token paths

## E20-18

### Completed

- [x] canonical role set aligned to tenant/AOK requirement docs
- [x] permission action list expanded from tenant/AOK requirement docs
- [x] role-permission matrix expanded with business-oriented actions
- [x] authorization service scaffold added
- [x] permission lookup endpoint added
- [x] permission allow/deny endpoint added
- [x] role matrix endpoint added for privileged roles
- [x] permission guard helper added
- [x] permission guard applied to protected endpoints
- [x] authorization integration tests added for deny/allow behavior

### Pending

- [ ] final business confirmation on canonical role naming
- [ ] add matrix-driven guards to more domain endpoints as services expand
- [ ] add role-action unit tests at service level in addition to integration tests

## E20-19

### Completed

- [x] tenant context shape introduced into auth/session flow
- [x] tenant-context module scaffold added
- [x] authorization and tenant-isolation folder structure prepared
- [x] tenant-owned vs shared-table isolation plan drafted from final schema
- [x] app-layer tenant scope helper added
- [x] privileged tenant-scope bypass helper added
- [x] user reads now apply tenant scoping unless platform override is present
- [x] initial RLS SQL scaffold added for direct tenant-owned tables
- [x] unit tests added for tenant scoping behavior

### Pending

- [x] Prisma tenant-context transaction wrapper
- [ ] full Postgres RLS migration SQL for all derived/joined tables
- [ ] tenant isolation enforcement in more real DB access paths beyond user reads
- [ ] `403` response handling for disallowed access
- [ ] privileged/BYPASSRLS path with audit coverage
- [ ] integration tests proving Tenant A cannot access Tenant B rows at DB level
- [ ] audit logging for privileged reads and writes

## Recommended execution order

1. Finish `E20-20`
2. Harden `E20-18`
3. Implement DB-backed enforcement for `E20-19`

## Notes

- Current auth implementation is good for local bootstrap and API contract testing.
- It is not yet production-complete because SSO resolution and DB-backed isolation are still pending.

## E20-22

### Completed

- [x] audit-trail implementation reviewed against the actual final SQL schema
- [x] reusable invitation-audit diff builder added in `@eventrax/database`
- [x] reusable invitation-audit bulk writer added in `@eventrax/database`
- [x] immutable SQL trigger added for `invitation_audit` `UPDATE` and `DELETE`
- [x] unit tests added for audit diff generation and no-op writes
- [x] booking-service invitation mutation endpoint now writes audit rows transactionally
- [x] booking-service invitation audit read endpoint added
- [x] local DB verification completed for rejected `UPDATE` on `invitation_audit`
- [x] local DB verification completed for rejected `DELETE` on `invitation_audit`
- [x] architecture note added to document the schema-vs-ticket gap

### Pending

- [ ] only if Jira insists on broader cross-domain audit: add a generic `audit_log` table and extend coverage beyond `invitation_audit`

## E20-21

### Completed

- [x] notification foundation reviewed against current repo and schema gap
- [x] Prisma models added for `notification` and `notification_job`
- [x] SQL foundation added for notification persistence and async jobs
- [x] shared notification dispatch contracts added
- [x] booking-service dispatch endpoint added for in-app notification creation plus email job queueing
- [x] idempotency support added on notification dispatch
- [x] booking-service list and mark-read endpoints added for in-app notifications
- [x] worker-service drain endpoint added for queued and retrying email jobs
- [x] worker-service dead-letter endpoint added
- [x] retry progression logic added for provider failures
- [x] mocked email provider and branded template renderer scaffold added
- [x] integration tests added for dispatch, read, queue drain, retry, and dead-letter paths

### Pending

- [ ] apply the notification SQL extension to non-local target database environments
- [ ] swap the mock email provider with AWS SES or final provider
- [ ] wire real booking, invitation, approval, and enquiry business events into notification dispatch

## E20-17

### Completed

- [x] AOK Swagger spec reviewed and mapped to implementable integration primitives
- [x] local AOK client scaffold added for enquiry create and enquiry lookup
- [x] `crm_ref` persistence field added to enquiry model
- [x] enquiry dispatch persistence added with idempotency via `dispatch_key`
- [x] booking-service dispatch endpoint added for AOK enquiry queueing
- [x] booking-service webhook endpoint added for AOK enquiry reconciliation
- [x] worker-service queue drain endpoint added for queued and retrying AOK dispatches
- [x] retry and dead-letter handling added for AOK dispatch failures
- [x] integration tests added for dispatch queueing, webhook reconciliation, drain success, retry, and DLQ paths

### Pending

- [ ] apply the AOK enquiry SQL extension to target database environments
- [ ] final business mapping of Eventrax flows `1-8` to public-enquiry vs existing-contact AOK endpoints
- [ ] final live AOK API key / production environment validation

## E20-57

### Completed

- [x] HMAC signing added to outbound AOK client requests (`AOK_HMAC_SECRET`, only sent when configured)
- [x] 409 responses from AOK treated as duplicate/success instead of thrown as an error
- [x] idempotency key changed to the enquiry id itself (server-derived), not a caller-supplied `dispatchKey`
- [x] dead-letter threshold corrected to 4 failures (previously 5) to match ticket AC
- [x] structured audit-style log line added on `crm_ref` assignment (no generic `AuditLog` table exists yet — see E20-22 note above; this is the stand-in until one is built)
- [x] unit + integration tests added for HMAC signing, 409 handling, idempotency, and dead-letter timing
- [x] `POST /api/v1/enquiries` create-enquiry endpoint added — creates the `Enquiry` row and its AOK dispatch job in one transaction, so "on submit → enqueue job" actually happens now (previously dispatch only worked against an enquiry that already existed, and no create endpoint existed anywhere in this repo)
- [x] `GET /api/v1/enquiries` list endpoint added, and the create response now also returns the full created `enquiry` row (previously only `enquiryId`/`dispatchId`) — eventrax-2.0's Enquiries screen (`features/enquiries/components/EnquiriesView.tsx`) held its data in local component state only (not even localStorage) seeded from mock data; it now fetches real rows on mount and posts new enquiries through this endpoint. `booking-service` was also missing CORS entirely (same gap fixed in event-service under E20-55/S2-02), which silently blocked every browser call to it regardless of path — fixed here since it blocks this too. Also fixed a pre-existing path bug: the frontend's `apiPost`/`apiGet` calls were hitting `/api/enquiries` (missing `/v1`) against a backend registered at `/api/v1/enquiries` — 404s that were previously masked by the CORS block firing first.

### Pending

- [ ] real `AOK_HMAC_SECRET` value not yet in any environment config
- [ ] "Pre-approval gate → not routed until approved" (AC) not implemented — there is no enquiry-level approval concept anywhere in this schema; `ApprovalRequest`/`ApprovalRule` only gate internal seat `Booking`s (a different, unrelated "Booking" from AOK's), not `Enquiry`. Building a real gate here means inventing a new Enquiry-approval workflow from scratch — flagged rather than guessed at
- [ ] `GET /api/v1/enquiries` has no real reference-number system behind it — the frontend derives a display `ENQ-XXXXXX` ref from the id client-side (see FRD job CEM-4a's "unique ETX2-generated reference number immediately on submission"); a real sequential/tenant-scoped ref generator hasn't been built
- [ ] `timeline`/`activity`/`aokNotes` shown on the Enquiries screen are synthesized client-side from the single `Enquiry` row (status + timestamps) — there's no audit-history table or `aokNotes` column backing them, so edits to AOK Notes in the UI don't persist

## E20-53

### Completed

- [x] `crm_inbound_event` ledger added (Prisma model + SQL foundation) for idempotent inbound webhook processing
- [x] inbound webhook signature verification added (`verifyAokWebhookSignature` in `@eventrax/config`) — confirmed against AOK's actual webhook docs: `X-API-Signature` / `X-API-Timestamp` headers, `HMAC-SHA256("v1:{timestamp}:{payload}")`, 5-minute replay window, constant-time comparison
- [x] signed receiver endpoint added: `POST /api/v1/integration/webhooks/3d/:category`, one route covering all five of AOK's webhook receiver categories (booking, client, contact, enquiry, organisation) — "Flows 9-13" turned out to be these five categories, not a `flow` field inside a shared payload
- [x] idempotency key resolved: `X-API-Event` header (a GUID AOK sends), not something derived — this was the ticket's own "PENDING ZTS field name" note, now closed
- [x] any redelivery of the same `X-API-Event` returns `409` regardless of the existing row's status (matches AC literally, not just "already fully processed")
- [x] flow router added (`packages/database/src/route-inbound-flow.ts`) — only `enquiry` has a real handler today, reusing the exact reconciliation logic the legacy webhook endpoint uses (extracted into `packages/database/src/reconcile-enquiry-dispatch.ts` so both `booking-service` and `worker-service` can call it — apps can't import each other's code in this monorepo, only shared packages)
- [x] worker drain/DLQ added: `POST /api/v1/jobs/integration/drain`, `GET /api/v1/jobs/integration/dlq`, same 4-attempt backoff ladder as E20-57
- [x] nightly-reconciliation endpoint added: `POST /api/v1/jobs/integration/reconcile` — requeues dead-lettered events for another drain pass
- [x] unit + integration tests added for signature verification, the flow router, the webhook endpoint (401/202/409/404 paths), and the worker drain/dlq/reconcile paths

### Pending

- [ ] apply `crm-inbound-event-foundation.sql` and re-run `pnpm db:generate` against target database environments before this does anything at runtime
- [ ] `booking`, `client`, `contact`, `organisation` categories have no confirmed payload shape or business logic anywhere — parked (not guessed at) until real requirements exist
- [ ] nightly reconciliation is requeue-only, not a real "pull authoritative state from 3D" as the ticket describes — there's no confirmed way to fetch authoritative state for the four parked categories, and even for `enquiry` a re-fetch wouldn't explain why our own dispatch lookup failed; revisit once more categories have real handlers
- [ ] no alerting on dead-lettered events — this is a cross-cutting gap, not specific to this ticket: no alerting channel (Slack/email/PagerDuty) exists anywhere in this repo yet, including for the existing outbound enquiry-dispatch DLQ from E20-17
- [ ] AOK's webhook receiver admin config (their five URL fields) not yet repointed at the new endpoint — nothing reaches this code until that's done on their side; legacy `POST /api/v1/webhooks/aok/enquiries` stays live in the meantime
- [ ] no contract test against a real ZTS/AOK sandbox environment
- [ ] real `AOK_WEBHOOK_SECRET` value not yet in any environment config (get from AOK's webhook config screen, never commit it)

## E20-58

### Completed

- [x] AOK's real OpenAPI spec (`aok-api.json`) reviewed — confirmed there is no `status_update`/`proposals_sent`/`proposal_accepted` webhook or field anywhere in their API; the only enquiry webhook is the existing `action: "Ignored" | "BookingSpawned"` payload E20-53/E20-57 already handle. AOK never pushes booking status or offer changes.
- [x] Re-scoped from "react to inbound webhook events" (as literally described) to "poll AOK's real `GET /api/v1/bookings/{bookingId}?include=Offers` endpoint" — the only way this data is actually reachable
- [x] `Enquiry.crmBookingRef` + `Enquiry.crmLastSyncAt` added; `EnquiryProposal.crmOfferedAt` added (dedupe key against AOK's `BookingOffer`, which has no stable id of its own)
- [x] `getBooking` added to the AOK client (`@eventrax/config`)
- [x] `route-inbound-flow.ts`'s enquiry handler now stores `crmBookingRef` when a `BookingSpawned` webhook resolves — the only time AOK ever tells us the booking id
- [x] `mirrorEnquiryStatusFromBooking` added (`packages/database`) — maps AOK's real `Booking.status` enum (`InNegotiation|Offered|Accepted|Unreviewed|Completed|Cancelled`) onto the ticket's client-facing state machine, upserts `EnquiryProposal` rows from `BookingOffer`s, notifies the requestor (idempotent per distinct status)
- [x] periodic drain added: `POST /api/v1/jobs/enquiries/status-mirror/drain` (worker-service) — polls every enquiry with a `crmBookingRef` and non-terminal status; same "requires an external caller" posture as E20-53's reconciliation endpoint (no real cron/scheduler exists in this repo)
- [x] "Unknown crm_ref → parked/flagged, alerted" AC implemented as a structured warn-log line (same stand-in pattern as elsewhere, no generic `AuditLog`/alerting channel existed until E20-59 added one)
- [x] unit + integration tests added for status mapping, proposal upsert/dedupe, accepted-offer override, notification idempotency, and the drain endpoint's synced/unknown/failed counts

### Pending

- [ ] AOK's real Booking.status enum has no equivalent to the ticket's "rejected" terminal state — left unmapped rather than guessed at; never occurs via this integration as currently understood
- [ ] apply `enquiry-status-mirror-foundation.sql` and re-run `pnpm db:generate` against target database environments
- [ ] no contract test against a real ZTS/AOK sandbox environment

## E20-55

### Completed

- [x] Confirmed "Listing"/"GuestInvite" (the ticket's terms) don't exist in this schema at all — real equivalents are `Event` and `Invitation`. Confirmed `event-service`'s module scaffold was entirely empty (no PATCH endpoint, no "S2-02 Listing CRUD" ticket's work anywhere) — this ticket's dependency doesn't actually exist as prior work
- [x] Built the minimal `PATCH /api/v1/events/:id` and `POST /api/v1/events/:id/cancel` endpoints from scratch (not full CRUD — just enough to support the cascade-notification behaviour this ticket asks for)
- [x] Material-change detection (`startDate`/`endDate`/`venueId`) vs cosmetic (title/description) — cosmetic changes confirmed not to trigger any cascade
- [x] `Invitation.needsReconfirmation` added; material changes flag it `true` and reset `status` to `pending_reconfirmation`
- [x] Cancellation cascades: booking status → `cancelled`, `InventoryItem.availableSeats` released via increment, structured audit-style log line per booking
- [x] Shared `dispatchNotification` helper extracted to `packages/database` (DI'd, same pattern as other cross-app shared logic) — reused by both the requestor (AppUser, resolved via `userId`) and guest (external `Guest.email`, no AppUser account needed — `Notification.userId` is nullable for exactly this) notification paths
- [x] Idempotency via deterministic `NotificationJob.idempotencyKey` per (event, booking/invitation, change-fingerprint) — confirmed identical repeat updates produce zero duplicate notifications
- [x] unit + integration tests added for cosmetic vs material detection, cascade fan-out, reconfirmation flagging, cancellation, idempotency, and already-cancelled guards

### Pending

- [x] ~~this is a minimal PATCH/cancel surface, not full Listing CRUD — no `POST`/`GET :id`/list-with-filters endpoints were built; a real "S2-02 Listing CRUD" ticket should still happen separately~~ — `POST /api/v1/events` (create) and `GET /api/v1/events` (list) added; eventrax-2.0's Listing page and Create Event wizard now round-trip through Postgres instead of localStorage only (see `src/lib/events-api.ts`, `src/lib/createdEvents.ts` kept as an optimistic-echo/offline-fallback cache, not the source of truth anymore). `GET :id` (single-event fetch) still doesn't exist.
- [ ] S2-02 follow-ups: no auth/tenant-context middleware exists yet (E20-20 still pending), so create/list accept `tenantId`/`createdBy` directly in the request rather than deriving them from a session — matches the same stopgap `enquiry-routes.ts` already uses. Wizard fields with no schema support were left out of `event-listing-crud-foundation.sql` on purpose: recurrence, agenda, host/approver assignment, waitlist cap, auto-invite, and multi-image galleries (only a single `thumbnail_url` string is stored, and it's a browser-local `blob:` URL today since there's no media upload/storage endpoint anywhere in this repo)
- [ ] "Email provider outage → listing update succeeds, notification job retries via DLQ" — relies on the existing E20-21 worker drain/DLQ machinery, not re-verified end-to-end here
- [ ] apply `listing-update-cascade-foundation.sql` and `event-listing-crud-foundation.sql`, then re-run `pnpm db:generate` against target database environments (couldn't run `prisma generate` in this environment — no network access to Prisma's engine binary CDN — so the generated `@prisma/client` types don't yet include `Event.dressCode`/`inclusions`/`bookingDeadline`/`thumbnailUrl` locally; the new route code accesses them through the same loosely-typed `tx: any`/`prisma.event` calls the rest of this file already uses, so it isn't blocked on that, but it should be regenerated for real type safety before relying on it)
- [ ] no integration tests added yet for the new `POST`/`GET /api/v1/events` routes (existing `event-routes.spec.ts` only covers PATCH/cancel)

## E20-59

### Completed

- [x] Confirmed no generic `AuditLog` table exists (only the narrow `invitation_audit` from E20-22) and no `GuestInvite`/`ExternalGuest` models exist — `Guest` and `Invitation` are the real PII holders this ticket maps onto
- [x] `RetentionPolicy` model + SQL added (`tenant_id`, `entity`, `retain_days`, `mode`, `is_active`) — only `entity: "guest"` has a real implementation; other entities are parked, same posture as E20-53's unconfirmed webhook categories
- [x] Generic `AuditLog` model + SQL added, with an immutable `UPDATE`/`DELETE`-blocking trigger mirroring E20-22's `invitation_audit` pattern — satisfies "erasure event itself recorded in audit log, not subsequently purged"
- [x] `hasActiveDependency` added — a guest is retained if any invitation's booking isn't in a terminal status, or its event hasn't finished yet (or has no end date at all, treated as open-ended)
- [x] `runRetentionSweep` added — both `purge` and `anonymise` modes implemented as full PII anonymisation + soft-delete (`deletedAt`), **not a literal SQL `DELETE`**: `Invitation` references `Guest` with no cascade, so a hard delete would either violate the FK or orphan invitation history. This also satisfies "aggregate history intact." Documented as a deliberate interpretation of "purge," not the literal word.
- [x] `eraseGuest` (right-to-erasure) added — anonymises + revokes RSVP tokens + audits, and deliberately does **not** check `hasActiveDependency` (a data-subject erasure request is a different, generally stronger obligation than the routine retention-policy sweep; the ticket's AC text doesn't scope "active dependency" to one path vs the other, so this is a documented interpretation)
- [x] `GDPR_RETENTION_ENABLED` config flag added, defaulting to `false` — every retention/erasure route checks it first and returns an inert `{ enabled: false }` response instead of doing anything, per the ticket's explicit "client legal/compliance sign-off required before enabling in production" note. Built fully, shipped inert.
- [x] `POST /api/v1/jobs/compliance/retention/run` and `POST /api/v1/compliance/guests/:id/erase` added (worker-service) — same "requires an external caller" posture as E20-53/E20-58 (no real cron/scheduler exists anywhere in this repo)
- [x] unit + integration tests added for active-dependency detection, sweep processing/retention, erasure (including the not-gated-on-dependency behavior), and the disabled-by-default flag gate on both routes

### Pending

- [ ] **disabled by default — do not flip `GDPR_RETENTION_ENABLED` to `true` in any environment until legal/compliance has actually signed off**, per the ticket
- [ ] `AppUser` also holds PII (email, name, SSO subject) but is deliberately out of scope — it's an internal system account, not guest data, and blanket-purging it is a different, riskier problem than this ticket describes; revisit as a separate, explicit decision if needed
- [ ] no real policy rows are seeded anywhere — the mechanism is inert both because of the flag and because no `RetentionPolicy` rows exist yet; real per-entity retention day counts were never provided
- [ ] apply `gdpr-retention-foundation.sql` and re-run `pnpm db:generate` against target database environments
- [ ] "legal hold exemption" edge case (mentioned in the ticket) not implemented — no legal-hold flag/mechanism exists anywhere in this schema

## FRD JIRA — Epic 1: Listing Management

### Completed

- [x] Story 1.1 "Listing enters pending-review on save, invisible until published" — `POST /api/v1/events` now defaults `status` to `pending_review` when the caller doesn't specify one; `useDiscoverEvents()` (Requester Browse) filters `status === "pending_review"` out entirely (Story 3.1's "simply absent" rule), while CEM/management screens (`Listing.tsx`, `EventTable.tsx`, `EventDetail.tsx`, `IndexV2.tsx`) still render it with a dedicated "Pending Review" badge so it can be reviewed
- [x] Story 1.4 "Track and display Listing source" — `event.source` column added (`aok-sourced` / `enquiry-originated` / `company-sourced`), auto-resolved server-side via `resolveEventSource()` (never a free-typed field a caller can override at will), backfilled existing rows to `company-sourced`. Displayed only on the CEM-facing `EventCard.tsx` (small violet origin pill, both full and compact card variants) via `PortfolioEvent.source`; the Requester-side `PortfolioEvent`/`DiscoverEvent` types (`features/requester/data/*`) never carry this field at all, so it's structurally impossible for `EventDiscoverDrawer.tsx` or any Requester screen to render it — satisfies Story 3.2's explicit "source is never shown to the employee" QA item

### Pending

- [ ] Story 1.7 "Link a Listing to its originating Enquiry" — the FRD's own yellow-highlighted "UI pending" marker; per user instruction, skipped
- [ ] Stories 1.2/1.3 (per-Listing sessions + per-session capacity) — deliberately deferred to last as the largest remaining Epic 1 item (tracked separately); `resolveEventSource()`'s `sourceEnquiryId` plumbing exists but nothing populates it yet since Story 1.7 (the UI that would set it) is out of scope
- [ ] Stories 1.5/1.6/1.8 not reviewed in this pass — revisit before declaring Epic 1 fully closed

## FRD JIRA — Epic 2: Publishing & Visibility Targeting

### Completed

- [x] Story 2.1 "Publish a Listing to one or more Requestor Groups" — `RequestorGroup`/`RequestorGroupMember` models added (`requestor-groups-and-publishing-foundation.sql`); no group/audience concept existed anywhere in this schema before (`AppUser.role` is a permission level, not an audience). `POST /api/v1/events/:id/publish` requires the caller to pass `groupIds`, defaulting to an auto-seeded "All Employees" group per tenant when omitted/empty — matches "default rather than block or leave ungrouped." Group-targeting is stored as `EventVisibility` rows with a new nullable `groupId` (additive alongside the pre-existing per-user `userId`/`role` mechanism, untouched). Every publish writes an `audit_log` row (reusing the generic immutable `AuditLog` from E20-59) recording actor + targeted group ids/names. Frontend: `EventDrawer.tsx`'s Publish button now opens a real group-picker dialog (fetches `GET /api/v1/requestor-groups`, checkboxes, defaults to "All Employees" if none checked) instead of the old cosmetic local-only toggle, for any backend-persisted (UUID-id) event; mock/local-only events keep the old cosmetic behaviour since there's nothing real to publish
- [x] Story 2.2 "Unpublish a Listing" — `POST /api/v1/events/:id/unpublish` clears `Event.publishedAt` (setting `unpublishedAt`) without touching `Booking`/`InventoryItem`/`EventVisibility` rows at all, so a later republish restores exactly the same group-targeting with no data loss. `publishedAt` (not `status`) is now the real visibility gate `useDiscoverEvents()` checks — tightened from the previous pass's `status !== "pending_review"` check, which would have missed an unpublished-but-still-"available"-status Listing. Audit-logged as `listing.unpublished`. Frontend: `EventDrawer.tsx`'s Hide button calls this for real
- [x] Story 2.3 "AOK force-publish a Listing" — same `POST /api/v1/events/:id/publish` endpoint, `forcedByAok: true` in the payload; still requires a target group (same default-to-"All Employees" behaviour), and the audit action string is `listing.force_published` (vs `listing.published`) so the audit trail unambiguously distinguishes it, per the AC. `Event.forcePublished` also persisted on the row itself
- [x] Story 2.5 "Expand visibility from an underperformance flag" — `POST /api/v1/events/:id/visibility/groups` adds Requestor Groups to an already-published Listing additively (existing `EventVisibility` rows untouched, duplicates skipped), audit-logged as `listing.visibility_expanded`. Requires the Listing to already be published (`400` otherwise, pointing at `/publish`)

### Pending

- [ ] Story 2.3's AOK-side trigger — no AOK portal screen in this frontend calls `forcedByAok: true` yet. `src/features/admin/pages/Inventory.tsx` looks like the intended home (it already has mock `publish`/`visibility` fields on its own disconnected `AdminEvent` type) but wiring that whole page to real events is a separate, larger effort on the same scale as the admin Enquiries wiring (task history above) — flagged rather than rushed into this pass
- [ ] Stories 2.4/2.6/2.7 (underperformance flagging, "Notify AOK," VIP/Restricted exclusion) — not built. These need a threshold/scheduler mechanism this pass doesn't touch; a separable feature. `RequestorGroup.isRestricted` and `Event.underperformanceFlagOverride` columns already exist so 2.7 has somewhere to plug in once flagging exists. 2.6 also explicitly depends on the not-yet-designed shared Notifications epic, per the FRD itself
- [ ] Group *membership* enforcement (which employees belong to which group) doesn't exist — no auth/session maps a logged-in Requester to their `RequestorGroupMember` rows (E20-20 still pending), so today every published (non-restricted-in-practice) Listing is visible to every Requester regardless of the groups it's targeted to. The data model and publish/unpublish mechanics are real; the "only this group's members can see it" enforcement is not, until real auth exists
- [ ] Backfill migration (`requestor-groups-and-publishing-foundation.sql`) walks every pre-existing `event` row not in `pending_review` and sets `published_at = created_at` + targets it at an auto-created "All Employees" group, so deploying this doesn't silently un-list everything that existed before Epic 2. Not tested against a real database in this environment — review before applying to any populated environment
- [ ] apply `requestor-groups-and-publishing-foundation.sql`, then re-run `pnpm db:generate` (same "no network access to Prisma's engine binary CDN" blocker as E20-55/E20-59) — `publishing-routes.ts` and the `GET /api/v1/events` include use a local `db = prisma as any` escape hatch for the new models/columns until the client is regenerated
- [ ] no integration tests added yet for `/publish`, `/unpublish`, `/visibility/groups`, or the `requestor-groups` routes

## FRD JIRA — Epic 3: Event Discovery (verification pass)

### Completed

- [x] Story 3.1 "Browse and filter Listings" — `Browse.tsx` supports date-range, venue, event-type, and availability filters plus sort by date/type/venue, all client-side over `useDiscoverEvents()`'s live-merged list (no full page reload). Fully-booked Listings remain visible with a "Full/Join waitlist" status chip rather than being hidden, per the AC
- [x] Story 3.2 "View Listing detail" — `EventDiscoverDrawer.tsx` renders description, dress code, booking deadline, capacity/availability, and asset name when populated. Confirmed `event.source` is never shown here — see Epic 1 Story 1.4 note above (not just omitted by convention, but structurally absent from the Requester's own `PortfolioEvent`/`DiscoverEvent` types)
- [x] Story 3.3 "Calendar view of Listings" — `Browse.tsx`'s `CalendarView` toggles alongside `ListView` over the same `filtered` array, so filter state and visibility rules are identical in both views

### Pending / known gaps (blocked on other epics, not defects in this pass)

- [ ] Story 3.1's "employee sees only Listings visible to their Requestor Group(s)" — no Requestor Group / visibility-targeting model exists yet (Epic 2 Story 2.1, not built); today every non-`pending_review` Listing is visible to every Requester
- [ ] Story 3.2's "per-session availability shown for multi-day Listings" — depends on Epic 1 Stories 1.2/1.3 (sessions), not built yet

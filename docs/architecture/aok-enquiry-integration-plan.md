# AOK Enquiry Integration Plan

`E20-17` technical foundation implemented from the provided AOK API spec.

## Implemented foundation

- local enquiry dispatch persistence with `enquiry_dispatch`
- `crm_ref` persistence on `enquiry`
- dispatch API in `booking-service`
- AOK webhook ingestion endpoint for enquiry reconciliation
- worker drain endpoint for queued/retrying AOK dispatches
- retry and dead-letter handling for failed AOK API calls
- typed AOK client for:
  - `POST /api/v1/enquiries`
  - `POST /api/v1/contacts/{contactId}/enquiries`
  - `GET /api/v1/enquiries/{enquiryId}`

## Endpoints added

- `POST /api/v1/enquiries/dispatch`
- `GET /api/v1/enquiries/:id/dispatches`
- `POST /api/v1/webhooks/aok/enquiries` (legacy — superseded by the signed endpoint below, kept live until AOK's config is repointed)
- `POST /api/v1/jobs/enquiries/drain`
- `GET /api/v1/jobs/enquiries/dlq`

### Added in E20-53 (signed inbound webhook receiver)

- `POST /api/v1/integration/webhooks/3d/:category` — one endpoint covering all five of AOK's webhook receiver categories (booking, client, contact, enquiry, organisation), with HMAC signature verification and an idempotent `crm_inbound_event` ledger. Only `enquiry` has a real handler; the rest are parked.
- `POST /api/v1/jobs/integration/drain`
- `GET /api/v1/jobs/integration/dlq`
- `POST /api/v1/jobs/integration/reconcile`

### Added in E20-57 (gap fix)

- `POST /api/v1/enquiries` — creates the `Enquiry` row and its AOK dispatch job in one transaction, so submitting an enquiry actually results in a queued dispatch (previously dispatch only worked against an enquiry that already existed).

### Added in E20-58 (status mirror — confirmed AOK has no webhook for this)

AOK's real OpenAPI spec (`aok-api.json`) confirmed there is no `status_update`/`proposals_sent`/`proposal_accepted` webhook or field anywhere in their API — the enquiry webhook is only ever `action: "Ignored" | "BookingSpawned"`. Everything else about booking status/offers must be polled from `GET /api/v1/bookings/{bookingId}?include=Offers`.

- `POST /api/v1/jobs/enquiries/status-mirror/drain` — polls every enquiry with a stored `crmBookingRef` and non-terminal status, maps AOK's real `Booking.status` enum onto the client-facing state machine, syncs `EnquiryProposal` rows from `BookingOffer`s, notifies the requestor.

See `docs/architecture/jira-ticket-checklist.md` (E20-53/E20-57/E20-58 sections) for the full completed/pending breakdown.

## Remaining dependency

The only material open item is business flow mapping:

- which Eventrax scenarios must use public enquiry creation
- which scenarios must use existing-contact enquiry creation
- final `enquirySource` values per business flow

## Closure position

This is enough to complete the technical integration foundation and move the ticket close to review. Full business sign-off on "Flows 1-8" still depends on confirming scenario-to-endpoint mapping.

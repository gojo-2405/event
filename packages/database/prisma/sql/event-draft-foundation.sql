-- Listing drafts: a CEM can "Save draft" from the Create Event wizard to persist an incomplete
-- Listing without publishing it. Drafts are stored as normal `event` rows flagged is_draft=true
-- and are excluded from the standard GET /api/v1/events listing (fetched only via ?draft=true).
-- All other event columns are already nullable, so a partially-filled draft persists cleanly.
--
-- Backfills existing rows to false: everything created before drafts existed is a real (non-draft)
-- Listing, so it must remain visible in the listing.
ALTER TABLE event
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

UPDATE event SET is_draft = false WHERE is_draft IS NULL;

-- A draft is saved partially, so columns the wizard may not have filled in yet must allow NULL.
-- schema.prisma already declares these optional (String?/DateTime?); the DB baseline shipped them
-- NOT NULL, so this aligns the two. Real (non-draft) creates still always populate them — the API
-- rejects a non-draft create that is missing title/eventType/startDate/capacity — so this only
-- relaxes the constraint for drafts, without weakening a real Listing's data in practice.
ALTER TABLE event
  ALTER COLUMN event_type DROP NOT NULL,
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date   DROP NOT NULL;

-- The Create Event wizard collects more than the event table has columns for (agenda, requestor
-- group selection, media, location type, etc.). For a draft we keep the full wizard form here as
-- JSON so "Resume" restores the form exactly as the CEM left it — nothing wizard-only is lost.
-- Only ever populated for is_draft=true rows; null for real Listings.
ALTER TABLE event
  ADD COLUMN IF NOT EXISTS draft_payload jsonb;

-- The default listing query is (tenant_id = ? AND is_draft = false); a partial index keeps that
-- fast and small by indexing only the non-draft rows it actually serves.
CREATE INDEX IF NOT EXISTS idx_event_tenant_not_draft
  ON event (tenant_id)
  WHERE is_draft = false;

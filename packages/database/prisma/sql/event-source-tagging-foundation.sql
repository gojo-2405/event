-- FRD JIRA Epic 1, Story 1.4: "Track and display Listing source." Every Listing must be
-- auto-tagged as one of aok-sourced / enquiry-originated / company-sourced, never editable,
-- and never shown to Requester-facing screens (internal/management-only column).
-- Backfills existing rows to 'company-sourced' — the only creation path this repo has ever
-- had (POST /api/v1/events, driven by the CEM Create Event wizard) — rather than guessing at
-- a more specific origin for data that predates this column.
ALTER TABLE event
  ADD COLUMN IF NOT EXISTS source varchar;

UPDATE event SET source = 'company-sourced' WHERE source IS NULL;

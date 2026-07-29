-- S2-02 Listing CRUD gap closure (flagged as pending under E20-55 in
-- docs/architecture/jira-ticket-checklist.md — event-service only ever had a PATCH/cancel
-- surface; no POST (create) or GET (list) endpoints existed for Event at all). Adding these
-- endpoints surfaces four fields the eventrax-2.0 Create Event wizard already collects
-- (dress code, inclusions, booking deadline, hero/thumbnail image) that `event` had no columns
-- for. Everything else the wizard captures (recurrence, agenda, host/approver assignment,
-- waitlist cap, auto-invite, multi-media gallery) is intentionally left out of this pass —
-- there's no schema support for those concepts yet and inventing one wasn't part of closing
-- this specific gap.
ALTER TABLE event
  ADD COLUMN IF NOT EXISTS dress_code varchar,
  ADD COLUMN IF NOT EXISTS inclusions varchar,
  ADD COLUMN IF NOT EXISTS booking_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS thumbnail_url varchar;

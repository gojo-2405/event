-- FRD JIRA Epic 2: Publishing & Visibility Targeting (Stories 2.1, 2.2, 2.3, 2.5, 2.7).
-- Requestor Groups are named employee audiences a Listing is published to — no such concept
-- existed anywhere in this schema before (AppUser.role is a permission level, not an audience).

CREATE TABLE IF NOT EXISTS requestor_group (
  id            uuid PRIMARY KEY,
  tenant_id     uuid,
  name          varchar NOT NULL,
  is_restricted boolean DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requestor_group_member (
  id         uuid PRIMARY KEY,
  group_id   uuid REFERENCES requestor_group(id),
  user_id    uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requestor_group_tenant ON requestor_group (tenant_id);
CREATE INDEX IF NOT EXISTS idx_requestor_group_member_group ON requestor_group_member (group_id);
CREATE INDEX IF NOT EXISTS idx_requestor_group_member_user ON requestor_group_member (user_id);

-- Story 2.1: visibility rows now also target a whole group, not just an individual user.
ALTER TABLE event_visibility
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES requestor_group(id);

CREATE INDEX IF NOT EXISTS idx_event_visibility_group ON event_visibility (group_id);

-- Story 2.1/2.2: publish/unpublish state, tracked separately from the booking-derived `status`
-- column so unpublishing never touches bookings/inventory (Story 2.2's "no data loss").
ALTER TABLE event
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS unpublished_at timestamptz,
  ADD COLUMN IF NOT EXISTS force_published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS underperformance_flag_override boolean DEFAULT false;

-- Backfill: every Listing that predates this migration and isn't sitting in pending_review was,
-- in practice, already visible to Requesters (there was no publish gate at all until now).
-- Without this, deploying Epic 2 would silently un-list every pre-existing Listing the moment
-- Requester screens start honouring `published_at` as the visibility gate. Treat
-- `created_at` as the effective publish time for these, and target them at the "All Employees"
-- group so they still show up correctly through the new group-visibility mechanism.
-- gen_random_uuid() is built into Postgres 13+ core; pgcrypto is only needed on older
-- versions. Harmless no-op if it's already available without the extension.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  ev RECORD;
  grp_id uuid;
BEGIN
  FOR ev IN SELECT id, tenant_id, created_at FROM event WHERE status <> 'pending_review' AND published_at IS NULL
  LOOP
    SELECT id INTO grp_id FROM requestor_group WHERE tenant_id IS NOT DISTINCT FROM ev.tenant_id AND name = 'All Employees' LIMIT 1;
    IF grp_id IS NULL THEN
      grp_id := gen_random_uuid();
      INSERT INTO requestor_group (id, tenant_id, name, is_restricted, created_at)
      VALUES (grp_id, ev.tenant_id, 'All Employees', false, now());
    END IF;

    UPDATE event SET published_at = COALESCE(ev.created_at, now()) WHERE id = ev.id;

    INSERT INTO event_visibility (id, event_id, group_id, created_at)
    SELECT gen_random_uuid(), ev.id, grp_id, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM event_visibility WHERE event_id = ev.id AND group_id = grp_id
    );
  END LOOP;
END $$;

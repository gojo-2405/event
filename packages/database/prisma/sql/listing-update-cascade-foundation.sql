-- E20-55: Listing Update + Cascade Notifications
-- No "Listing"/"GuestInvite" models exist in this schema (the ticket's terms) — "Event" and
-- "Invitation" are the real equivalents. This adds only the one new column Invitation needs;
-- everything else (material-change detection, notification fan-out) is application logic.
ALTER TABLE invitation
  ADD COLUMN IF NOT EXISTS needs_reconfirmation boolean DEFAULT false;

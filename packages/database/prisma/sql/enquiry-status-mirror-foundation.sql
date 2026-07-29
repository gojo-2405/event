-- E20-58: Enquiry Status Updates (mirror from 3D)
-- AOK has no webhook for booking status/offer changes — only the enquiry-level
-- BookingSpawned/Ignored event (see enquiry-status-mirror-plan.md). These columns support
-- a periodic poll against GET /api/v1/bookings/{bookingId} instead.
ALTER TABLE enquiry
  ADD COLUMN IF NOT EXISTS crm_booking_ref integer,
  ADD COLUMN IF NOT EXISTS crm_last_sync_at timestamptz;

ALTER TABLE enquiry_proposal
  ADD COLUMN IF NOT EXISTS crm_offered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_enquiry_crm_booking_ref
  ON enquiry (crm_booking_ref)
  WHERE crm_booking_ref IS NOT NULL;

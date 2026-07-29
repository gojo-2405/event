-- Frontend/AOK-parity gap closure: the submission wizard in eventrax-2.0 asks for
-- Category and Purpose (steps 1-2) and a Budget with Currency + Tax (part of the Details
-- step), none of which had columns on `enquiry` before this. Also adds `cancelled_at` for
-- the new enquiry-level cancel endpoint (distinct from the E20-55 event/booking cancel,
-- which cancels a Listing's Booking, not a not-yet-booked Enquiry).
ALTER TABLE enquiry
  ADD COLUMN IF NOT EXISTS category varchar,
  ADD COLUMN IF NOT EXISTS purpose varchar,
  ADD COLUMN IF NOT EXISTS currency varchar,
  ADD COLUMN IF NOT EXISTS tax_amount decimal,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Align legacy databases with the current Prisma schema, which models
-- `enquiry.enquiry_type` as optional. Older environments may still have a
-- NOT NULL constraint on this column, causing inserts to fail when newer
-- clients omit `enquiryType` and rely on `category` instead.
ALTER TABLE enquiry
  ALTER COLUMN enquiry_type DROP NOT NULL;

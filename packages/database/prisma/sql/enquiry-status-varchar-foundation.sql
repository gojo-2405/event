-- Align legacy databases with the current Prisma schema, which models `status`
-- on `enquiry` as a free-text varchar. Older environments may still have this
-- column as a Postgres enum, which rejects newer values like "submitted".
--
-- This converts the column to varchar in-place while preserving existing values.
ALTER TABLE enquiry
  ALTER COLUMN status TYPE varchar USING status::text;

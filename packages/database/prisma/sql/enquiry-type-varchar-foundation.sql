-- Align legacy databases with the current Prisma schema, which models `enquiry_type`
-- as a free-text varchar. Some older environments still have this column as a Postgres
-- enum, which rejects newer UI values like "Corporate Hospitality" and "Tickets".
--
-- This converts the column to varchar in-place while preserving existing values.
ALTER TABLE enquiry
  ALTER COLUMN enquiry_type TYPE varchar USING enquiry_type::text;

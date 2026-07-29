\set ON_ERROR_STOP on

-- Run this file with:
--   psql "$DATABASE_URL" -f packages/database/prisma/sql/dev-bootstrap-all.sql
--
-- Purpose:
-- - create the full current Eventrax shared schema
-- - apply DB-only foundations (RBAC seeds, requestor-group support, audit immutability, RLS)
-- - reseed the Acme dev tenant with stable CEM / Requestor / event / booking / enquiry data

\i packages/database/prisma/sql/dev-full-schema-baseline.sql
\i packages/database/prisma/sql/gdpr-retention-foundation.sql
\i packages/database/prisma/sql/immutable-audit.sql
\i packages/database/prisma/sql/rbac-foundation.sql
\i packages/database/prisma/sql/requestor-groups-and-publishing-foundation.sql
\i packages/database/prisma/sql/rls-policies.sql
\i packages/database/prisma/sql/dev-acme-reseed.sql

CREATE INDEX IF NOT EXISTS idx_enquiry_crm_booking_ref
  ON enquiry (crm_booking_ref)
  WHERE crm_booking_ref IS NOT NULL;

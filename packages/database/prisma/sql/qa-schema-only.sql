\set ON_ERROR_STOP on

-- Run this file with:
--   PGPASSWORD='...' psql "postgresql://USER@HOST:5432/DB?sslmode=require" \
--     -f packages/database/prisma/sql/qa-schema-only.sql
--
-- Purpose:
-- - create the full current Eventrax shared schema
-- - apply non-Prisma DB behavior (immutable audit triggers, RLS helpers/policies)
-- - DO NOT seed any tenant/demo/auth/sidebar data
--
-- Notes:
-- - This is safe for an empty QA database bootstrap.
-- - `role`, `screen`, and `role_screen` tables will be created but remain empty.
-- - No tenant, app_user, event, booking, enquiry, or demo data is inserted.

\i packages/database/prisma/sql/dev-full-schema-baseline.sql
\i packages/database/prisma/sql/gdpr-retention-foundation.sql
\i packages/database/prisma/sql/immutable-audit.sql
\i packages/database/prisma/sql/rls-policies.sql

CREATE INDEX IF NOT EXISTS idx_enquiry_crm_booking_ref
  ON enquiry (crm_booking_ref)
  WHERE crm_booking_ref IS NOT NULL;

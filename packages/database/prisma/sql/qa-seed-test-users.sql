\set ON_ERROR_STOP on

-- QA test users for Karthick, Gokulraaj, Sugumar — one CEM + one Requester each (6 total).
--   psql "$DATABASE_URL" -f packages/database/prisma/sql/qa-seed-test-users.sql
--
-- Password: identical to the existing Pepsi user rachita.chawla@pepsi.com (the hash is copied
-- straight from that row, so the same login password works — no plaintext needed here).
-- role_id is resolved by role key so it always matches QA's actual role rows.
--
-- Prerequisite: rbac-foundation.sql must already be applied (role rows `cem`/`requestor` and the
-- role_screen matrix must exist), otherwise the role_id lookups return NULL and login shows no
-- screens. Run this AFTER the RBAC seed.

BEGIN;

-- Idempotent: remove any prior copies of exactly these six accounts before reinserting.
DELETE FROM app_user WHERE email IN (
  'karthick.cem@pepsi.com',  'karthick.requestor@pepsi.com',
  'gokulraaj.cem@pepsi.com', 'gokulraaj.requestor@pepsi.com',
  'sugumar.cem@pepsi.com',   'sugumar.requestor@pepsi.com'
);

INSERT INTO app_user (
  id, tenant_id, email, first_name, last_name, role, password_hash, role_id,
  is_active, created_at, updated_at
) VALUES
(
  'c0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000099',
  'karthick.cem@pepsi.com', 'Karthick', 'CEM', 'manager',
  (SELECT password_hash FROM app_user WHERE email = 'rachita.chawla@pepsi.com' AND password_hash IS NOT NULL LIMIT 1),
  (SELECT id FROM role WHERE key = 'cem'),
  true, now(), now()
),
(
  'c0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000099',
  'karthick.requestor@pepsi.com', 'Karthick', 'Requestor', 'employee',
  (SELECT password_hash FROM app_user WHERE email = 'rachita.chawla@pepsi.com' AND password_hash IS NOT NULL LIMIT 1),
  (SELECT id FROM role WHERE key = 'requestor'),
  true, now(), now()
),
(
  'c0000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000099',
  'gokulraaj.cem@pepsi.com', 'Gokulraaj', 'CEM', 'manager',
  (SELECT password_hash FROM app_user WHERE email = 'rachita.chawla@pepsi.com' AND password_hash IS NOT NULL LIMIT 1),
  (SELECT id FROM role WHERE key = 'cem'),
  true, now(), now()
),
(
  'c0000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000099',
  'gokulraaj.requestor@pepsi.com', 'Gokulraaj', 'Requestor', 'employee',
  (SELECT password_hash FROM app_user WHERE email = 'rachita.chawla@pepsi.com' AND password_hash IS NOT NULL LIMIT 1),
  (SELECT id FROM role WHERE key = 'requestor'),
  true, now(), now()
),
(
  'c0000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000099',
  'sugumar.cem@pepsi.com', 'Sugumar', 'CEM', 'manager',
  (SELECT password_hash FROM app_user WHERE email = 'rachita.chawla@pepsi.com' AND password_hash IS NOT NULL LIMIT 1),
  (SELECT id FROM role WHERE key = 'cem'),
  true, now(), now()
),
(
  'c0000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000099',
  'sugumar.requestor@pepsi.com', 'Sugumar', 'Requestor', 'employee',
  (SELECT password_hash FROM app_user WHERE email = 'rachita.chawla@pepsi.com' AND password_hash IS NOT NULL LIMIT 1),
  (SELECT id FROM role WHERE key = 'requestor'),
  true, now(), now()
);

COMMIT;

-- Verify: expect 6 rows, each with a non-null password_hash and a resolved role.
SELECT u.email, r.key AS role, (u.password_hash IS NOT NULL) AS has_password, u.is_active
FROM app_user u
LEFT JOIN role r ON r.id = u.role_id
WHERE u.email IN (
  'karthick.cem@pepsi.com',  'karthick.requestor@pepsi.com',
  'gokulraaj.cem@pepsi.com', 'gokulraaj.requestor@pepsi.com',
  'sugumar.cem@pepsi.com',   'sugumar.requestor@pepsi.com'
)
ORDER BY u.email;

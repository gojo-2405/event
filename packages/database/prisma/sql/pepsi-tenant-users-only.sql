\set ON_ERROR_STOP on

-- Pepsi tenant + users only bootstrap
--
-- Safe for an existing database:
-- - does not delete bookings, events, enquiries, guests, invitations, or audit data
-- - only creates or updates the Pepsi tenant, Pepsi users, and Pepsi requestor groups
--
-- Credentials
-- - rachita.chawla@pepsi.com / Admin123!   (CEM)
-- - sjp@pepsi.com / Admin123!              (Requestor)
-- - daksh.panchal@pepsi.com / Admin123!    (Requestor)
-- - meera.iyer@pepsi.com / Admin123!       (Requestor)

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- Tenant
-- ---------------------------------------------------------------------------------------------

INSERT INTO tenant (
  id,
  name,
  slug,
  primary_color,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000099'::uuid,
  'Pepsi',
  'pepsi',
  '#d14d8b',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant
  WHERE id = '00000000-0000-0000-0000-000000000099'::uuid
     OR slug = 'pepsi'
);

UPDATE tenant
SET
  name = 'Pepsi',
  slug = 'pepsi',
  primary_color = '#d14d8b',
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid
   OR slug = 'pepsi';

-- ---------------------------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------------------------

UPDATE app_user
SET
  tenant_id = '00000000-0000-0000-0000-000000000099'::uuid,
  first_name = 'Rachita',
  last_name = 'Chawla',
  role = 'manager',
  password_hash = 'scrypt$1112131415161718191a1b1c1d1e1f20$912b185cf766ee41f544ad91849d5dc2580b6d17af7b97d8ae7a8a1a951d7aea9f60ad6f26ffe06bcdeed6f22b5ae9024d73c4791faba5816918739ed9fb6c6b',
  role_id = 'a0000000-0000-0000-0000-000000000001'::uuid,
  is_active = true,
  updated_at = now()
WHERE email = 'rachita.chawla@pepsi.com';

INSERT INTO app_user (
  id,
  tenant_id,
  email,
  first_name,
  last_name,
  role,
  password_hash,
  role_id,
  is_active,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000009910'::uuid,
  '00000000-0000-0000-0000-000000000099'::uuid,
  'rachita.chawla@pepsi.com',
  'Rachita',
  'Chawla',
  'manager',
  'scrypt$1112131415161718191a1b1c1d1e1f20$912b185cf766ee41f544ad91849d5dc2580b6d17af7b97d8ae7a8a1a951d7aea9f60ad6f26ffe06bcdeed6f22b5ae9024d73c4791faba5816918739ed9fb6c6b',
  'a0000000-0000-0000-0000-000000000001'::uuid,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM app_user WHERE email = 'rachita.chawla@pepsi.com'
);

UPDATE app_user
SET
  tenant_id = '00000000-0000-0000-0000-000000000099'::uuid,
  first_name = 'SJP',
  last_name = 'Selvaraj',
  role = 'employee',
  password_hash = 'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  role_id = 'a0000000-0000-0000-0000-000000000002'::uuid,
  is_active = true,
  updated_at = now()
WHERE email = 'sjp@pepsi.com';

INSERT INTO app_user (
  id,
  tenant_id,
  email,
  first_name,
  last_name,
  role,
  password_hash,
  role_id,
  is_active,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000009911'::uuid,
  '00000000-0000-0000-0000-000000000099'::uuid,
  'sjp@pepsi.com',
  'SJP',
  'Selvaraj',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002'::uuid,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM app_user WHERE email = 'sjp@pepsi.com'
);

UPDATE app_user
SET
  tenant_id = '00000000-0000-0000-0000-000000000099'::uuid,
  first_name = 'Daksh',
  last_name = 'Panchal',
  role = 'employee',
  password_hash = 'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  role_id = 'a0000000-0000-0000-0000-000000000002'::uuid,
  is_active = true,
  updated_at = now()
WHERE email = 'daksh.panchal@pepsi.com';

INSERT INTO app_user (
  id,
  tenant_id,
  email,
  first_name,
  last_name,
  role,
  password_hash,
  role_id,
  is_active,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000009912'::uuid,
  '00000000-0000-0000-0000-000000000099'::uuid,
  'daksh.panchal@pepsi.com',
  'Daksh',
  'Panchal',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002'::uuid,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM app_user WHERE email = 'daksh.panchal@pepsi.com'
);

UPDATE app_user
SET
  tenant_id = '00000000-0000-0000-0000-000000000099'::uuid,
  first_name = 'Meera',
  last_name = 'Iyer',
  role = 'employee',
  password_hash = 'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  role_id = 'a0000000-0000-0000-0000-000000000002'::uuid,
  is_active = true,
  updated_at = now()
WHERE email = 'meera.iyer@pepsi.com';

INSERT INTO app_user (
  id,
  tenant_id,
  email,
  first_name,
  last_name,
  role,
  password_hash,
  role_id,
  is_active,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000009913'::uuid,
  '00000000-0000-0000-0000-000000000099'::uuid,
  'meera.iyer@pepsi.com',
  'Meera',
  'Iyer',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002'::uuid,
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM app_user WHERE email = 'meera.iyer@pepsi.com'
);

-- ---------------------------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------------------------

DELETE FROM requestor_group_member
WHERE group_id IN (
  '79000000-0000-0000-0000-000000000001'::uuid,
  '79000000-0000-0000-0000-000000000002'::uuid
);

DELETE FROM requestor_group
WHERE id IN (
  '79000000-0000-0000-0000-000000000001'::uuid,
  '79000000-0000-0000-0000-000000000002'::uuid
);

INSERT INTO requestor_group (
  id,
  tenant_id,
  name,
  is_restricted,
  created_at
) VALUES
(
  '79000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000099',
  'All Users',
  false,
  now()
),
(
  '79000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000099',
  'Leadership Circle',
  true,
  now()
);

INSERT INTO requestor_group_member (
  id,
  group_id,
  user_id,
  created_at
)
SELECT '79100000-0000-0000-0000-000000000001'::uuid, '79000000-0000-0000-0000-000000000001'::uuid, id, now()
FROM app_user
WHERE email = 'rachita.chawla@pepsi.com';

INSERT INTO requestor_group_member (
  id,
  group_id,
  user_id,
  created_at
)
SELECT '79100000-0000-0000-0000-000000000002'::uuid, '79000000-0000-0000-0000-000000000001'::uuid, id, now()
FROM app_user
WHERE email = 'sjp@pepsi.com';

INSERT INTO requestor_group_member (
  id,
  group_id,
  user_id,
  created_at
)
SELECT '79100000-0000-0000-0000-000000000003'::uuid, '79000000-0000-0000-0000-000000000001'::uuid, id, now()
FROM app_user
WHERE email = 'daksh.panchal@pepsi.com';

INSERT INTO requestor_group_member (
  id,
  group_id,
  user_id,
  created_at
)
SELECT '79100000-0000-0000-0000-000000000004'::uuid, '79000000-0000-0000-0000-000000000001'::uuid, id, now()
FROM app_user
WHERE email = 'meera.iyer@pepsi.com';

INSERT INTO requestor_group_member (
  id,
  group_id,
  user_id,
  created_at
)
SELECT '79100000-0000-0000-0000-000000000005'::uuid, '79000000-0000-0000-0000-000000000002'::uuid, id, now()
FROM app_user
WHERE email = 'rachita.chawla@pepsi.com';

INSERT INTO requestor_group_member (
  id,
  group_id,
  user_id,
  created_at
)
SELECT '79100000-0000-0000-0000-000000000006'::uuid, '79000000-0000-0000-0000-000000000002'::uuid, id, now()
FROM app_user
WHERE email = 'sjp@pepsi.com';

COMMIT;

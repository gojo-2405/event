\set ON_ERROR_STOP on

-- QA Pepsi tenant + users bootstrap
--
-- Purpose
-- - Creates the Pepsi tenant in QA
-- - Creates Pepsi QA login users
-- - Creates Pepsi requestor groups used by the app
-- - Does NOT create listings, bookings, enquiries, guests, invitations, or demo data
--
-- Intended target
-- - QA RDS database only
--
-- Run example
--   PGPASSWORD='<qa-password>' \
--   psql "postgresql://developer_qa@qa-eventrax.cn0owcy2sefu.eu-west-2.rds.amazonaws.com:5432/eventrax-qa?sslmode=require" \
--     -f packages/database/prisma/sql/qa-pepsi-tenant-users-only.sql
--
-- Credentials
-- - rachita.chawla@pepsi.com / Admin123!   (CEM)
-- - sjp@pepsi.com / Admin123!              (Requestor)
-- - daksh.panchal@pepsi.com / Admin123!    (Requestor)
-- - meera.iyer@pepsi.com / Admin123!       (Requestor)
--
-- Notes
-- - This file is intentionally non-destructive for QA business data.
-- - If Pepsi rows already exist, they are updated in place.

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- Required master roles
-- ---------------------------------------------------------------------------------------------

INSERT INTO role (id, key, label, description, is_active, created_at)
SELECT
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'cem',
  'CEM (Management)',
  'Client Event Manager — management console',
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM role WHERE key = 'cem'
);

INSERT INTO role (id, key, label, description, is_active, created_at)
SELECT
  'a0000000-0000-0000-0000-000000000002'::uuid,
  'requestor',
  'Requester',
  'Employee who browses and books events',
  true,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM role WHERE key = 'requestor'
);

-- ---------------------------------------------------------------------------------------------
-- Pepsi tenant
-- ---------------------------------------------------------------------------------------------

INSERT INTO tenant (
  id,
  name,
  slug,
  logo_url,
  primary_color,
  is_active,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000099'::uuid,
  'Pepsi',
  'pepsi',
  NULL,
  '#d14d8b',
  true,
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
  logo_url = NULL,
  primary_color = '#d14d8b',
  is_active = true,
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000099'::uuid
   OR slug = 'pepsi';

-- ---------------------------------------------------------------------------------------------
-- Pepsi users
-- ---------------------------------------------------------------------------------------------

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
  seed.id,
  '00000000-0000-0000-0000-000000000099'::uuid,
  seed.email,
  seed.first_name,
  seed.last_name,
  seed.role::user_role,
  seed.password_hash,
  seed.role_id,
  true,
  now(),
  now()
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-000000009910'::uuid,
      'rachita.chawla@pepsi.com',
      'Rachita',
      'Chawla',
      'manager',
      'scrypt$1112131415161718191a1b1c1d1e1f20$912b185cf766ee41f544ad91849d5dc2580b6d17af7b97d8ae7a8a1a951d7aea9f60ad6f26ffe06bcdeed6f22b5ae9024d73c4791faba5816918739ed9fb6c6b',
      'a0000000-0000-0000-0000-000000000001'::uuid
    ),
    (
      '00000000-0000-0000-0000-000000009911'::uuid,
      'sjp@pepsi.com',
      'SJP',
      'Selvaraj',
      'employee',
      'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
      'a0000000-0000-0000-0000-000000000002'::uuid
    ),
    (
      '00000000-0000-0000-0000-000000009912'::uuid,
      'daksh.panchal@pepsi.com',
      'Daksh',
      'Panchal',
      'employee',
      'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
      'a0000000-0000-0000-0000-000000000002'::uuid
    ),
    (
      '00000000-0000-0000-0000-000000009913'::uuid,
      'meera.iyer@pepsi.com',
      'Meera',
      'Ilyer',
      'employee',
      'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
      'a0000000-0000-0000-0000-000000000002'::uuid
    )
) AS seed(id, email, first_name, last_name, role, password_hash, role_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM app_user u
  WHERE u.id = seed.id
     OR u.email = seed.email
);

UPDATE app_user
SET
  tenant_id = '00000000-0000-0000-0000-000000000099'::uuid,
  first_name = seed.first_name,
  last_name = seed.last_name,
  role = seed.role::user_role,
  password_hash = seed.password_hash,
  role_id = seed.role_id,
  is_active = true,
  updated_at = now()
FROM (
  VALUES
    (
      '00000000-0000-0000-0000-000000009910'::uuid,
      'rachita.chawla@pepsi.com',
      'Rachita',
      'Chawla',
      'manager',
      'scrypt$1112131415161718191a1b1c1d1e1f20$912b185cf766ee41f544ad91849d5dc2580b6d17af7b97d8ae7a8a1a951d7aea9f60ad6f26ffe06bcdeed6f22b5ae9024d73c4791faba5816918739ed9fb6c6b',
      'a0000000-0000-0000-0000-000000000001'::uuid
    ),
    (
      '00000000-0000-0000-0000-000000009911'::uuid,
      'sjp@pepsi.com',
      'SJP',
      'Selvaraj',
      'employee',
      'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
      'a0000000-0000-0000-0000-000000000002'::uuid
    ),
    (
      '00000000-0000-0000-0000-000000009912'::uuid,
      'daksh.panchal@pepsi.com',
      'Daksh',
      'Panchal',
      'employee',
      'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
      'a0000000-0000-0000-0000-000000000002'::uuid
    ),
    (
      '00000000-0000-0000-0000-000000009913'::uuid,
      'meera.iyer@pepsi.com',
      'Meera',
      'Ilyer',
      'employee',
      'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
      'a0000000-0000-0000-0000-000000000002'::uuid
    )
) AS seed(id, email, first_name, last_name, role, password_hash, role_id)
WHERE app_user.id = seed.id
   OR app_user.email = seed.email;

-- ---------------------------------------------------------------------------------------------
-- Pepsi requestor groups
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
) VALUES
  ('79100000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009910', now()),
  ('79100000-0000-0000-0000-000000000002', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009911', now()),
  ('79100000-0000-0000-0000-000000000003', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009912', now()),
  ('79100000-0000-0000-0000-000000000004', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009913', now()),
  ('79100000-0000-0000-0000-000000000005', '79000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000009910', now()),
  ('79100000-0000-0000-0000-000000000006', '79000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000009911', now());

COMMIT;

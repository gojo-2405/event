\set ON_ERROR_STOP on

-- Run after the schema/foundation SQL has been applied:
--   psql "$DATABASE_URL" -f packages/database/prisma/sql/dev-acme-reseed.sql
--
-- Purpose:
-- - reset only the seeded Kaaylabs dev tenant data
-- - keep shared/reference tables and other tenants untouched
-- - reseed a clean CEM + Requestor dataset aligned with the current frontend demo IDs
--
-- Seeded login users
-- - admin@acme.example.com / Admin123!   (CEM)
-- - manager@acme.example.com / Admin123! (CEM)
-- - employee@acme.example.com / Admin123! (Requester)

BEGIN;

-- ---------------------------------------------------------------------------------------------
-- Tenant-scoped cleanup (Kaaylabs only)
-- ---------------------------------------------------------------------------------------------

DELETE FROM notification_job
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM notification
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- audit_log is intentionally immutable (trigger-protected), so we do not delete historical rows
-- during reseed. This keeps the reset safe and consistent with production expectations.

DELETE FROM crm_inbound_event
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM enquiry_dispatch
WHERE enquiry_id IN (
  SELECT id FROM enquiry WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM enquiry_proposal
WHERE enquiry_id IN (
  SELECT id FROM enquiry WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
)
OR booking_id IN (
  SELECT id FROM booking WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM enquiry
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM invitation
WHERE booking_id IN (
  SELECT id FROM booking WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM approval_request
WHERE booking_id IN (
  SELECT id FROM booking WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM entitlement_ledger
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM booking
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM inventory_snapshot
WHERE event_id IN (
  SELECT id FROM event WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM event_visibility
WHERE event_id IN (
  SELECT id FROM event WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM inventory_item
WHERE event_id IN (
  SELECT id FROM event WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM event
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM approval_rule
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM entitlement
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM requestor_group_member
WHERE group_id IN (
  SELECT id FROM requestor_group WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
);

DELETE FROM requestor_group
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM guest
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM app_user
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM tenant
WHERE id = '00000000-0000-0000-0000-000000000001';

DELETE FROM venue
WHERE id IN (
  '20000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000004'
);

-- ---------------------------------------------------------------------------------------------
-- Tenant + users
-- ---------------------------------------------------------------------------------------------

INSERT INTO tenant (
  id, name, slug, primary_color, is_active, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Kaaylabs',
  'kaaylabs',
  '#d14d8b',
  true,
  now(),
  now()
);

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
) VALUES
(
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'admin@acme.example.com',
  'Elena',
  'Martins',
  'manager',
  'scrypt$0102030405060708090a0b0c0d0e0f10$7d8d7efbecf70993ef6187e5abbc5f7264ac83e621d74a79a1681bd418371cbc9eabb6fdffa6a9a9f6a7d70c01804d498d7328989ebeb588aaa99d740333688a',
  'a0000000-0000-0000-0000-000000000001',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'manager@acme.example.com',
  'Rachita',
  'Chawla Bhatia',
  'manager',
  'scrypt$1112131415161718191a1b1c1d1e1f20$912b185cf766ee41f544ad91849d5dc2580b6d17af7b97d8ae7a8a1a951d7aea9f60ad6f26ffe06bcdeed6f22b5ae9024d73c4791faba5816918739ed9fb6c6b',
  'a0000000-0000-0000-0000-000000000001',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  'employee@acme.example.com',
  'Priya',
  'Raman',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000001',
  'sarah.johnson@acme.example.com',
  'Sarah',
  'Johnson',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000001',
  'daniel.reeves@acme.example.com',
  'Daniel',
  'Reeves',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000015',
  '00000000-0000-0000-0000-000000000001',
  'hannah.mueller@acme.example.com',
  'Hannah',
  'Mueller',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000016',
  '00000000-0000-0000-0000-000000000001',
  'marco.bianchi@acme.example.com',
  'Marco',
  'Bianchi',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000017',
  '00000000-0000-0000-0000-000000000001',
  'aisha.rahman@acme.example.com',
  'Aisha',
  'Rahman',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000018',
  '00000000-0000-0000-0000-000000000001',
  'liam.carter@acme.example.com',
  'Liam',
  'Carter',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000019',
  '00000000-0000-0000-0000-000000000001',
  'james.oconnor@acme.example.com',
  'James',
  'O''Connor',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  'eva.novak@acme.example.com',
  'Eva',
  'Novak',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000001',
  'priya.shah@acme.example.com',
  'Priya',
  'Shah',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000001',
  'tom.hayes@acme.example.com',
  'Tom',
  'Hayes',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
);

-- ---------------------------------------------------------------------------------------------
-- Requestor groups
-- ---------------------------------------------------------------------------------------------

INSERT INTO requestor_group (
  id, tenant_id, name, is_restricted, created_at
) VALUES
(
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'All Employees',
  false,
  now()
),
(
  '70000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Executive Circle',
  true,
  now()
);

INSERT INTO requestor_group_member (
  id, group_id, user_id, created_at
) VALUES
(
  '71000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  now()
),
(
  '71000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  now()
),
(
  '71000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000012',
  now()
),
(
  '71000000-0000-0000-0000-000000000004',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000013',
  now()
),
(
  '71000000-0000-0000-0000-000000000005',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000014',
  now()
),
(
  '71000000-0000-0000-0000-000000000006',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000015',
  now()
),
(
  '71000000-0000-0000-0000-000000000007',
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000016',
  now()
),
(
  '71000000-0000-0000-0000-000000000008',
  '70000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000013',
  now()
),
(
  '71000000-0000-0000-0000-000000000009',
  '70000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000016',
  now()
);

-- ---------------------------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------------------------

INSERT INTO event_category (id, name, description, created_at)
SELECT
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Sports',
  'Sporting fixtures and hospitality',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM event_category WHERE name = 'Sports'
);

INSERT INTO event_category (id, name, description, created_at)
SELECT
  '10000000-0000-0000-0000-000000000002'::uuid,
  'Conference',
  'Corporate conferences and summits',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM event_category WHERE name = 'Conference'
);

INSERT INTO event_category (id, name, description, created_at)
SELECT
  '10000000-0000-0000-0000-000000000003'::uuid,
  'Music',
  'Concerts and music events',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM event_category WHERE name = 'Music'
);

INSERT INTO event_category (id, name, description, created_at)
SELECT
  '10000000-0000-0000-0000-000000000004'::uuid,
  'Dining',
  'Private dining and hosted dinners',
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM event_category WHERE name = 'Dining'
);

INSERT INTO venue (
  id, name, address_line1, city, country, postcode, capacity, created_at, updated_at
) VALUES
(
  '20000000-0000-0000-0000-000000000001',
  'Old Trafford',
  'Sir Matt Busby Way',
  'Manchester',
  'United Kingdom',
  'M16 0RA',
  1000,
  now(),
  now()
),
(
  '20000000-0000-0000-0000-000000000002',
  'Stamford Bridge',
  'Fulham Road',
  'London',
  'United Kingdom',
  'SW6 1HS',
  800,
  now(),
  now()
),
(
  '20000000-0000-0000-0000-000000000003',
  'Elland Road',
  'Elland Road',
  'Leeds',
  'United Kingdom',
  'LS11 0ES',
  60,
  now(),
  now()
),
(
  '20000000-0000-0000-0000-000000000004',
  'The Savoy',
  'Strand',
  'London',
  'United Kingdom',
  'WC2R 0EZ',
  180,
  now(),
  now()
);

-- ---------------------------------------------------------------------------------------------
-- Events + visibility
-- ---------------------------------------------------------------------------------------------

INSERT INTO event (
  id,
  tenant_id,
  category_id,
  venue_id,
  title,
  description,
  event_type,
  status,
  start_date,
  end_date,
  is_invitation_only,
  is_multi_date,
  supplier,
  dress_code,
  inclusions,
  booking_deadline,
  thumbnail_url,
  source,
  is_published,
  published_at,
  created_by,
  created_at,
  updated_at
) SELECT
  '30000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM event_category WHERE name = 'Sports' LIMIT 1),
  '20000000-0000-0000-0000-000000000001'::uuid,
  'Manchester United vs Arsenal',
  'Premium matchday hospitality with hosted dining, premium seating, and post-match networking.',
  'Premier League',
  'published',
  '2026-07-28T15:00:00Z'::timestamptz,
  '2026-07-28T20:00:00Z'::timestamptz,
  false,
  false,
  'AOK Events',
  'Smart casual',
  'Premium seating, hosted bar, post-match lounge access',
  '2026-07-27T18:00:00Z'::timestamptz,
  'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-10T09:00:00Z'::timestamptz,
  '00000000-0000-0000-0000-000000000010'::uuid,
  '2026-07-10T09:00:00Z'::timestamptz,
  now()
UNION ALL
SELECT
  '30000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM event_category WHERE name = 'Sports' LIMIT 1),
  '20000000-0000-0000-0000-000000000002'::uuid,
  'Chelsea vs Arsenal',
  'Classic hospitality listing for client entertainment with central London access and premium service.',
  'Premier League',
  'published',
  '2026-07-25T15:00:00Z'::timestamptz,
  '2026-07-25T20:00:00Z'::timestamptz,
  false,
  false,
  'AOK Events',
  'Business casual',
  'Padded seats, drinks package, post-match networking',
  '2026-07-24T17:00:00Z'::timestamptz,
  'https://images.unsplash.com/photo-1508098682722-e99c643e7485?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-08T09:00:00Z'::timestamptz,
  '00000000-0000-0000-0000-000000000010'::uuid,
  '2026-07-08T09:00:00Z'::timestamptz,
  now()
UNION ALL
SELECT
  '30000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM event_category WHERE name = 'Sports' LIMIT 1),
  '20000000-0000-0000-0000-000000000003'::uuid,
  'Leeds United vs Manchester United',
  'Smaller capacity hosted football experience designed for internal team rewards and light client hosting.',
  'Premier League',
  'published',
  '2026-07-23T15:00:00Z'::timestamptz,
  '2026-07-23T19:30:00Z'::timestamptz,
  false,
  false,
  'AOK Events',
  'Casual smart',
  'Match tickets, drinks reception, lounge entry',
  '2026-07-22T18:00:00Z'::timestamptz,
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-05T09:00:00Z'::timestamptz,
  '00000000-0000-0000-0000-000000000011'::uuid,
  '2026-07-05T09:00:00Z'::timestamptz,
  now()
UNION ALL
SELECT
  '30000000-0000-0000-0000-000000000004'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  (SELECT id FROM event_category WHERE name = 'Dining' LIMIT 1),
  '20000000-0000-0000-0000-000000000004'::uuid,
  'Client Relationship Dinner',
  'Private dining listing still under review and not yet visible to requestors.',
  'Private Dining',
  'pending_review',
  '2026-08-14T18:30:00Z'::timestamptz,
  '2026-08-14T22:00:00Z'::timestamptz,
  true,
  false,
  'AOK Events',
  'Business formal',
  'Three-course dinner, sommelier pairing, hosted room',
  '2026-08-10T18:00:00Z'::timestamptz,
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  false,
  NULL::timestamptz,
  '00000000-0000-0000-0000-000000000010'::uuid,
  '2026-07-20T09:00:00Z'::timestamptz,
  now();

INSERT INTO inventory_item (
  id,
  event_id,
  package_type,
  total_seats,
  available_seats,
  unit_price,
  supplier,
  usage_rules,
  version,
  created_at,
  updated_at
) VALUES
(
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'corporate',
  1000,
  280,
  450.00,
  'AOK Events',
  'One active booking per requestor',
  1,
  now(),
  now()
),
(
  '40000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  'corporate',
  800,
  188,
  375.00,
  'AOK Events',
  'Client-hosted usage only',
  1,
  now(),
  now()
),
(
  '40000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  'group',
  60,
  38,
  150.00,
  'AOK Events',
  'Smaller hosted allocation',
  1,
  now(),
  now()
),
(
  '40000000-0000-0000-0000-000000000004',
  '30000000-0000-0000-0000-000000000004',
  'premium',
  180,
  180,
  220.00,
  'AOK Events',
  'Invite-only until publish',
  1,
  now(),
  now()
);

INSERT INTO event_visibility (
  id, event_id, group_id, created_at
) VALUES
(
  '41000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  now()
),
(
  '41000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000001',
  now()
),
(
  '41000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000001',
  now()
);

-- ---------------------------------------------------------------------------------------------
-- Bookings (confirmed guest list + pending CEM requests)
-- ---------------------------------------------------------------------------------------------

INSERT INTO booking (
  id,
  tenant_id,
  event_id,
  inventory_item_id,
  requester_id,
  booked_by_id,
  seats_requested,
  purpose,
  business_purpose,
  status,
  total_cost,
  unit_value_per_guest,
  notes,
  created_at,
  updated_at
) VALUES
(
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000013',
  180,
  'Client entertainment',
  'Relationship building',
  'confirmed',
  81000.00,
  450.00,
  'Confirmed allocation for key clients',
  '2026-07-18T09:21:00Z',
  '2026-07-18T10:00:00Z'
),
(
  '50000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000014',
  220,
  'Investor hosting',
  'Capital markets relationship management',
  'confirmed',
  99000.00,
  450.00,
  'Large hosted group',
  '2026-07-18T09:51:00Z',
  '2026-07-18T10:20:00Z'
),
(
  '50000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000015',
  '00000000-0000-0000-0000-000000000015',
  140,
  'Senior banking guests',
  'Wealth client hosting',
  'confirmed',
  63000.00,
  450.00,
  'Approved by CEM',
  '2026-07-18T11:21:00Z',
  '2026-07-18T11:40:00Z'
),
(
  '50000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000016',
  '00000000-0000-0000-0000-000000000016',
  180,
  'Board entertainment',
  'Strategic client hosting',
  'confirmed',
  81000.00,
  450.00,
  'Board-approved group',
  '2026-07-18T11:51:00Z',
  '2026-07-18T12:10:00Z'
),
(
  '50000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000012',
  6,
  'Team reward request',
  'Employee engagement',
  'pending_approval',
  2700.00,
  450.00,
  'Waiting for CEM approval',
  '2026-07-21T09:21:00Z',
  '2026-07-21T09:21:00Z'
),
(
  '50000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000013',
  8,
  'Urgent client extension',
  'Additional relationship seats',
  'pending_approval',
  3600.00,
  450.00,
  'Second request awaiting review',
  '2026-07-21T09:51:00Z',
  '2026-07-21T09:51:00Z'
),
(
  '50000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000012',
  320,
  'Corporate client dinner guests',
  'Client entertainment',
  'confirmed',
  120000.00,
  375.00,
  'Confirmed bulk allocation',
  '2026-07-17T09:00:00Z',
  '2026-07-17T11:00:00Z'
),
(
  '50000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000013',
  292,
  'Premier client allocation',
  'Client entertainment',
  'confirmed',
  109500.00,
  375.00,
  'Key account allocation',
  '2026-07-17T09:20:00Z',
  '2026-07-17T10:00:00Z'
),
(
  '50000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000016',
  '00000000-0000-0000-0000-000000000016',
  12,
  'Late add-on request',
  'Relationship extension',
  'pending_approval',
  4500.00,
  375.00,
  'Pending second-round review',
  '2026-07-21T10:15:00Z',
  '2026-07-21T10:15:00Z'
),
(
  '50000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000020',
  10,
  'Kestrel client invite extension',
  'Research relationship management',
  'pending_approval',
  3750.00,
  375.00,
  'Pending CEM review',
  '2026-07-21T12:21:00Z',
  '2026-07-21T12:21:00Z'
),
(
  '50000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000019',
  '00000000-0000-0000-0000-000000000019',
  6,
  'Blue Harbor priority request',
  'Senior client attendance',
  'pending_approval',
  2250.00,
  375.00,
  'Waiting for manager decision',
  '2026-07-21T13:51:00Z',
  '2026-07-21T13:51:00Z'
),
(
  '50000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000017',
  '00000000-0000-0000-0000-000000000017',
  8,
  'Brightstack hosted guests',
  'Portfolio relationship event',
  'pending_approval',
  3000.00,
  375.00,
  'Escalated for review',
  '2026-07-21T14:21:00Z',
  '2026-07-21T14:21:00Z'
),
(
  '50000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000018',
  '00000000-0000-0000-0000-000000000018',
  4,
  'Vellum relationship seats',
  'Associate follow-up invitation',
  'pending_approval',
  1500.00,
  375.00,
  'Pending first-pass approval',
  '2026-07-21T14:51:00Z',
  '2026-07-21T14:51:00Z'
),
(
  '50000000-0000-0000-0000-000000000015',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000015',
  '00000000-0000-0000-0000-000000000015',
  5,
  'Nordwerk final request',
  'Relationship management',
  'pending_approval',
  1875.00,
  375.00,
  'Needs approval before deadline',
  '2026-07-21T11:21:00Z',
  '2026-07-21T11:21:00Z'
),
(
  '50000000-0000-0000-0000-000000000016',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000011',
  3,
  'Everline executive add-on',
  'Leadership relationship seats',
  'pending_approval',
  1125.00,
  375.00,
  'Manual review requested',
  '2026-07-21T10:51:00Z',
  '2026-07-21T10:51:00Z'
),
(
  '50000000-0000-0000-0000-000000000017',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000021',
  7,
  'Northwind hosted request',
  'Priority relationship booking',
  'pending_approval',
  2625.00,
  375.00,
  'Executive review requested',
  '2026-07-21T10:21:00Z',
  '2026-07-21T10:21:00Z'
),
(
  '50000000-0000-0000-0000-000000000018',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000022',
  '00000000-0000-0000-0000-000000000022',
  3,
  'Everline associate request',
  'Additional attendance request',
  'pending_approval',
  1125.00,
  375.00,
  'Awaiting first approval',
  '2026-07-21T10:31:00Z',
  '2026-07-21T10:31:00Z'
),
(
  '50000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000014',
  22,
  'Regional team reward',
  'Employee engagement',
  'confirmed',
  3300.00,
  150.00,
  'Small group booking',
  '2026-07-16T10:00:00Z',
  '2026-07-16T10:40:00Z'
);

-- ---------------------------------------------------------------------------------------------
-- Enquiries
-- ---------------------------------------------------------------------------------------------

INSERT INTO enquiry (
  id,
  tenant_id,
  submitted_by_id,
  assigned_to_id,
  crm_ref,
  enquiry_type,
  category,
  purpose,
  title,
  preferred_date,
  preferred_location,
  budget,
  currency,
  guest_count,
  notes,
  status,
  attachment_urls,
  created_at,
  updated_at
) VALUES
(
  '60000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000010',
  'AOK-ENQ-1001',
  'Corporate Hospitality',
  'Corporate Hospitality',
  'Client entertainment',
  'Manchester hospitality enquiry',
  '2026-08-12',
  'Manchester',
  25000.00,
  'GBP',
  40,
  'Priority client relationship opportunity',
  'submitted',
  ARRAY[]::varchar[],
  '2026-07-20T09:00:00Z',
  '2026-07-20T09:00:00Z'
),
(
  '60000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000013',
  '00000000-0000-0000-0000-000000000011',
  'AOK-ENQ-1002',
  'Private Dining',
  'Private Dining',
  'Investor dinner',
  'Executive dinner enquiry',
  '2026-08-18',
  'London',
  18000.00,
  'GBP',
  18,
  'Need premium private room',
  'proposal_received',
  ARRAY[]::varchar[],
  '2026-07-19T11:00:00Z',
  '2026-07-20T11:30:00Z'
),
(
  '60000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000014',
  '00000000-0000-0000-0000-000000000010',
  'AOK-ENQ-1003',
  'Tickets',
  'Tickets',
  'Partner reward',
  'Wimbledon ticket request',
  '2026-08-01',
  'London',
  8000.00,
  'GBP',
  6,
  'Looking for Centre Court seats',
  'in_progress',
  ARRAY[]::varchar[],
  '2026-07-18T12:30:00Z',
  '2026-07-21T09:30:00Z'
);

COMMIT;

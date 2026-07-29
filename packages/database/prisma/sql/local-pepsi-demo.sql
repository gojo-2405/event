\set ON_ERROR_STOP on

-- Localhost-only Pepsi demo seed
--
-- Run with:
--   psql "postgresql://admin:Admin123@localhost:5432/aok_dev" \
--     -f packages/database/prisma/sql/local-pepsi-demo.sql
--
-- Demo credentials
-- - rachita.chawla@pepsi.example.com / Admin123!   (CEM)
-- - sjp@pepsi.example.com / Admin123!              (Requestor)
-- - daksh.panchal@pepsi.example.com / Admin123!   (Requestor)
-- - meera.iyer@pepsi.example.com / Admin123!      (Requestor)
--
-- Notes
-- - This seeds a separate Pepsi tenant for localhost demos only.
-- - Shared immutable tables (audit_log / invitation_audit) are never deleted.
-- - Event/booking/invitation ids are regenerated on each run so stale immutable audit rows
--   from prior runs do not appear against the newly seeded demo events.

BEGIN;

CREATE TEMP TABLE demo_event_ids (
  key text PRIMARY KEY,
  id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE demo_inventory_ids (
  key text PRIMARY KEY,
  id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE demo_booking_ids (
  key text PRIMARY KEY,
  id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE demo_guest_ids (
  key text PRIMARY KEY,
  id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE demo_invitation_ids (
  key text PRIMARY KEY,
  id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE demo_approval_ids (
  key text PRIMARY KEY,
  id uuid NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE demo_enquiry_ids (
  key text PRIMARY KEY,
  id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO demo_event_ids (key, id) VALUES
  ('available', gen_random_uuid()),
  ('almost_full', gen_random_uuid()),
  ('full', gen_random_uuid()),
  ('waitlisted', gen_random_uuid()),
  ('cancelled', gen_random_uuid()),
  ('unpublished', gen_random_uuid());

INSERT INTO demo_inventory_ids (key, id) VALUES
  ('available', gen_random_uuid()),
  ('almost_full', gen_random_uuid()),
  ('full', gen_random_uuid()),
  ('waitlisted', gen_random_uuid()),
  ('cancelled', gen_random_uuid()),
  ('unpublished', gen_random_uuid());

INSERT INTO demo_booking_ids (key, id) VALUES
  ('available_pending_daksh', gen_random_uuid()),
  ('available_pending_meera', gen_random_uuid()),
  ('unpublished_pending_sjp', gen_random_uuid()),
  ('unpublished_pending_daksh', gen_random_uuid()),
  ('almost_full_confirmed_sjp', gen_random_uuid()),
  ('almost_full_confirmed_daksh', gen_random_uuid()),
  ('almost_full_confirmed_meera', gen_random_uuid()),
  ('full_confirmed_sjp', gen_random_uuid()),
  ('full_confirmed_daksh', gen_random_uuid()),
  ('full_confirmed_meera', gen_random_uuid()),
  ('waitlisted_confirmed_sjp', gen_random_uuid()),
  ('waitlisted_confirmed_daksh', gen_random_uuid()),
  ('waitlisted_waitlist_meera', gen_random_uuid()),
  ('cancelled_cancelled_sjp', gen_random_uuid());

INSERT INTO demo_guest_ids (key, id) VALUES
  ('almost_full_sjp', gen_random_uuid()),
  ('almost_full_daksh', gen_random_uuid()),
  ('almost_full_meera', gen_random_uuid()),
  ('full_sjp', gen_random_uuid()),
  ('full_daksh', gen_random_uuid()),
  ('full_meera', gen_random_uuid()),
  ('waitlisted_sjp', gen_random_uuid()),
  ('waitlisted_daksh', gen_random_uuid());

INSERT INTO demo_invitation_ids (key, id) VALUES
  ('almost_full_sjp', gen_random_uuid()),
  ('almost_full_daksh', gen_random_uuid()),
  ('almost_full_meera', gen_random_uuid()),
  ('full_sjp', gen_random_uuid()),
  ('full_daksh', gen_random_uuid()),
  ('full_meera', gen_random_uuid()),
  ('waitlisted_sjp', gen_random_uuid()),
  ('waitlisted_daksh', gen_random_uuid());

INSERT INTO demo_approval_ids (key, id) VALUES
  ('available_pending_daksh', gen_random_uuid()),
  ('available_pending_meera', gen_random_uuid()),
  ('unpublished_pending_sjp', gen_random_uuid()),
  ('unpublished_pending_daksh', gen_random_uuid());

INSERT INTO demo_enquiry_ids (key, id) VALUES
  ('submitted', gen_random_uuid()),
  ('proposal_received', gen_random_uuid()),
  ('in_progress', gen_random_uuid());

-- ---------------------------------------------------------------------------------------------
-- Cleanup (Pepsi tenant only)
-- ---------------------------------------------------------------------------------------------

DELETE FROM notification_job
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM notification
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM crm_inbound_event
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM enquiry_dispatch
WHERE enquiry_id IN (
  SELECT id FROM enquiry WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM enquiry_proposal
WHERE enquiry_id IN (
  SELECT id FROM enquiry WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
)
OR booking_id IN (
  SELECT id FROM booking WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM enquiry
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM invitation
WHERE booking_id IN (
  SELECT id FROM booking WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM approval_request
WHERE booking_id IN (
  SELECT id FROM booking WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM entitlement_ledger
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM booking
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM inventory_snapshot
WHERE event_id IN (
  SELECT id FROM event WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM event_visibility
WHERE event_id IN (
  SELECT id FROM event WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM inventory_item
WHERE event_id IN (
  SELECT id FROM event WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM event
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM approval_rule
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM entitlement
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM requestor_group_member
WHERE group_id IN (
  SELECT id FROM requestor_group WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
);

DELETE FROM requestor_group
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM guest
WHERE tenant_id = '00000000-0000-0000-0000-000000000099';

DELETE FROM app_user
WHERE tenant_id = '00000000-0000-0000-0000-000000000099'
   OR email IN (
     'rachita.chawla@pepsi.example.com',
     'sjp@pepsi.example.com',
     'daksh.panchal@pepsi.example.com',
     'meera.iyer@pepsi.example.com'
   );

DELETE FROM tenant
WHERE id = '00000000-0000-0000-0000-000000000099';

DELETE FROM venue
WHERE id IN (
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002',
  '92000000-0000-0000-0000-000000000003',
  '92000000-0000-0000-0000-000000000004'
);

-- ---------------------------------------------------------------------------------------------
-- Tenant + users
-- ---------------------------------------------------------------------------------------------

INSERT INTO tenant (
  id, name, slug, primary_color, is_active, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000099',
  'Pepsi',
  'pepsi-demo',
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
  '00000000-0000-0000-0000-000000009910',
  '00000000-0000-0000-0000-000000000099',
  'rachita.chawla@pepsi.example.com',
  'Rachita',
  'Chawla',
  'manager',
  'scrypt$1112131415161718191a1b1c1d1e1f20$912b185cf766ee41f544ad91849d5dc2580b6d17af7b97d8ae7a8a1a951d7aea9f60ad6f26ffe06bcdeed6f22b5ae9024d73c4791faba5816918739ed9fb6c6b',
  'a0000000-0000-0000-0000-000000000001',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000009911',
  '00000000-0000-0000-0000-000000000099',
  'sjp@pepsi.example.com',
  'SJP',
  'Selvaraj',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000009912',
  '00000000-0000-0000-0000-000000000099',
  'daksh.panchal@pepsi.example.com',
  'Daksh',
  'Panchal',
  'employee',
  'scrypt$2122232425262728292a2b2c2d2e2f30$8a9e7edef598d616aeba814c84e64fba68819fb0389e70f79995cafdbfbeb6b9272ae783b2a578dce190ba500c471e87316837284b10fadd226069ec1fec294d',
  'a0000000-0000-0000-0000-000000000002',
  true,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000009913',
  '00000000-0000-0000-0000-000000000099',
  'meera.iyer@pepsi.example.com',
  'Meera',
  'Iyer',
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
  id, group_id, user_id, created_at
) VALUES
  ('79100000-0000-0000-0000-000000000001', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009910', now()),
  ('79100000-0000-0000-0000-000000000002', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009911', now()),
  ('79100000-0000-0000-0000-000000000003', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009912', now()),
  ('79100000-0000-0000-0000-000000000004', '79000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000009913', now()),
  ('79100000-0000-0000-0000-000000000005', '79000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000009910', now()),
  ('79100000-0000-0000-0000-000000000006', '79000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000009911', now());

-- ---------------------------------------------------------------------------------------------
-- Approval rules
-- ---------------------------------------------------------------------------------------------

INSERT INTO approval_rule (
  id,
  tenant_id,
  event_type,
  min_spend,
  max_spend,
  auto_approve,
  approver_role,
  created_at,
  updated_at
) VALUES (
  '78000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000099',
  'conference',
  0.00,
  100000.00,
  false,
  'manager',
  now(),
  now()
);

-- ---------------------------------------------------------------------------------------------
-- Shared reference data
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
  '92000000-0000-0000-0000-000000000001',
  'O2 Arena',
  'Peninsula Square',
  'London',
  'United Kingdom',
  'SE10 0DX',
  20000,
  now(),
  now()
),
(
  '92000000-0000-0000-0000-000000000002',
  'Silverstone Circuit',
  'Towcester',
  'Northamptonshire',
  'United Kingdom',
  'NN12 8TN',
  150000,
  now(),
  now()
),
(
  '92000000-0000-0000-0000-000000000003',
  'The Savoy',
  'Strand',
  'London',
  'United Kingdom',
  'WC2R 0EZ',
  250,
  now(),
  now()
),
(
  '92000000-0000-0000-0000-000000000004',
  'Pepsi Innovation Hub',
  '1 Future Way',
  'London',
  'United Kingdom',
  'EC2A 1AA',
  400,
  now(),
  now()
);

-- ---------------------------------------------------------------------------------------------
-- Events
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
  unpublished_at,
  force_published,
  created_by,
  created_at,
  updated_at
) VALUES
(
  (SELECT id FROM demo_event_ids WHERE key = 'available'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM event_category WHERE name = 'Conference' LIMIT 1),
  '92000000-0000-0000-0000-000000000004',
  'Pepsi Sales Kickoff',
  'Available demo listing with live pending requests ready for CEM approval during the stakeholder walkthrough.',
  'Conference',
  'available',
  '2026-07-26T09:30:00Z',
  '2026-07-26T17:00:00Z',
  false,
  false,
  'Pepsi Events Team',
  'Business casual',
  'Keynotes, networking lunch, breakout rooms',
  '2026-07-25T18:00:00Z',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-18T08:00:00Z',
  NULL,
  false,
  '00000000-0000-0000-0000-000000009910',
  '2026-07-18T08:00:00Z',
  now()
),
(
  (SELECT id FROM demo_event_ids WHERE key = 'almost_full'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM event_category WHERE name = 'Sports' LIMIT 1),
  '92000000-0000-0000-0000-000000000002',
  'Pepsi Grand Prix Lounge',
  'Main demo listing for guest list, RSVP accepted/declined, and audit history.',
  'Formula 1',
  'available',
  '2026-07-29T13:30:00Z',
  '2026-07-29T20:30:00Z',
  false,
  false,
  'AOK Events',
  'Smart casual',
  'Trackside lounge, premium catering, driver Q&A',
  '2026-07-27T18:00:00Z',
  'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-16T08:30:00Z',
  NULL,
  false,
  '00000000-0000-0000-0000-000000009910',
  '2026-07-16T08:30:00Z',
  now()
),
(
  (SELECT id FROM demo_event_ids WHERE key = 'full'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM event_category WHERE name = 'Dining' LIMIT 1),
  '92000000-0000-0000-0000-000000000003',
  'Pepsi Leadership Dinner',
  'Fully booked demo listing for the CEM full state.',
  'Private Dining',
  'full',
  '2026-07-31T18:30:00Z',
  '2026-07-31T22:00:00Z',
  true,
  false,
  'AOK Events',
  'Business formal',
  'Three-course tasting menu, private room, sommelier pairings',
  '2026-07-29T18:00:00Z',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-14T10:00:00Z',
  NULL,
  false,
  '00000000-0000-0000-0000-000000009910',
  '2026-07-14T10:00:00Z',
  now()
),
(
  (SELECT id FROM demo_event_ids WHERE key = 'waitlisted'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM event_category WHERE name = 'Music' LIMIT 1),
  '92000000-0000-0000-0000-000000000001',
  'Pepsi Music Night',
  'Waitlisted demo listing with exhausted seats and live waitlist count.',
  'Classical Concert',
  'waitlisted',
  '2026-08-02T18:00:00Z',
  '2026-08-02T22:30:00Z',
  false,
  false,
  'AOK Events',
  'Cocktail',
  'Stage-side access, open bar, private reception',
  '2026-07-30T18:00:00Z',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-12T08:00:00Z',
  NULL,
  false,
  '00000000-0000-0000-0000-000000009910',
  '2026-07-12T08:00:00Z',
  now()
),
(
  (SELECT id FROM demo_event_ids WHERE key = 'cancelled'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM event_category WHERE name = 'Dining' LIMIT 1),
  '92000000-0000-0000-0000-000000000003',
  'Pepsi CMO Dinner',
  'Cancelled published listing to demo the cancelled state.',
  'Private Dining',
  'cancelled',
  '2026-08-05T19:00:00Z',
  '2026-08-05T22:00:00Z',
  true,
  false,
  'AOK Events',
  'Business formal',
  'Private dining room, champagne reception',
  '2026-08-01T18:00:00Z',
  'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  true,
  '2026-07-11T08:00:00Z',
  NULL,
  false,
  '00000000-0000-0000-0000-000000009910',
  '2026-07-11T08:00:00Z',
  now()
),
(
  (SELECT id FROM demo_event_ids WHERE key = 'unpublished'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM event_category WHERE name = 'Conference' LIMIT 1),
  '92000000-0000-0000-0000-000000000004',
  'Pepsi Internal Summit Draft',
  'Unpublished listing kept visible only to CEM users for the demo.',
  'Conference',
  'pending_review',
  '2026-08-12T10:00:00Z',
  '2026-08-12T17:30:00Z',
  false,
  false,
  'Pepsi Events Team',
  'Business',
  'Panels, workshops, closing remarks',
  '2026-08-09T18:00:00Z',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
  'company-sourced',
  false,
  NULL,
  '2026-07-20T09:00:00Z',
  false,
  '00000000-0000-0000-0000-000000009910',
  '2026-07-20T09:00:00Z',
  now()
);

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
  (SELECT id FROM demo_inventory_ids WHERE key = 'available'),
  (SELECT id FROM demo_event_ids WHERE key = 'available'),
  'standard',
  50,
  50,
  150.00,
  'Pepsi Events Team',
  'One request per employee',
  1,
  now(),
  now()
),
(
  (SELECT id FROM demo_inventory_ids WHERE key = 'almost_full'),
  (SELECT id FROM demo_event_ids WHERE key = 'almost_full'),
  'premium',
  40,
  6,
  350.00,
  'AOK Events',
  'Premium lounge allocation',
  1,
  now(),
  now()
),
(
  (SELECT id FROM demo_inventory_ids WHERE key = 'full'),
  (SELECT id FROM demo_event_ids WHERE key = 'full'),
  'corporate',
  20,
  0,
  420.00,
  'AOK Events',
  'Leadership hospitality only',
  1,
  now(),
  now()
),
(
  (SELECT id FROM demo_inventory_ids WHERE key = 'waitlisted'),
  (SELECT id FROM demo_event_ids WHERE key = 'waitlisted'),
  'vip',
  20,
  0,
  275.00,
  'AOK Events',
  'Join waitlist once full',
  1,
  now(),
  now()
),
(
  (SELECT id FROM demo_inventory_ids WHERE key = 'cancelled'),
  (SELECT id FROM demo_event_ids WHERE key = 'cancelled'),
  'premium',
  18,
  18,
  300.00,
  'AOK Events',
  'Cancelled demo listing',
  1,
  now(),
  now()
),
(
  (SELECT id FROM demo_inventory_ids WHERE key = 'unpublished'),
  (SELECT id FROM demo_event_ids WHERE key = 'unpublished'),
  'standard',
  120,
  120,
  120.00,
  'Pepsi Events Team',
  'Draft inventory',
  1,
  now(),
  now()
);

INSERT INTO event_visibility (
  id, event_id, group_id, created_at
) VALUES
  (gen_random_uuid(), (SELECT id FROM demo_event_ids WHERE key = 'available'), '79000000-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), (SELECT id FROM demo_event_ids WHERE key = 'almost_full'), '79000000-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), (SELECT id FROM demo_event_ids WHERE key = 'full'), '79000000-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), (SELECT id FROM demo_event_ids WHERE key = 'waitlisted'), '79000000-0000-0000-0000-000000000001', now()),
  (gen_random_uuid(), (SELECT id FROM demo_event_ids WHERE key = 'cancelled'), '79000000-0000-0000-0000-000000000001', now());

-- ---------------------------------------------------------------------------------------------
-- Bookings + requests
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
  waitlist_position,
  total_cost,
  unit_value_per_guest,
  notes,
  created_at,
  updated_at
) VALUES
(
  (SELECT id FROM demo_booking_ids WHERE key = 'available_pending_daksh'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'available'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'available'),
  '00000000-0000-0000-0000-000000009912',
  '00000000-0000-0000-0000-000000009912',
  4,
  'Regional leadership request',
  'Customer relationship building',
  'pending_approval',
  NULL,
  600.00,
  150.00,
  'Awaiting Rachita approval for client guests',
  '2026-07-22T09:15:00Z',
  '2026-07-22T09:15:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'available_pending_meera'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'available'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'available'),
  '00000000-0000-0000-0000-000000009913',
  '00000000-0000-0000-0000-000000009913',
  3,
  'Team reward request',
  'Employee recognition',
  'pending_approval',
  NULL,
  450.00,
  150.00,
  'Pending CEM review',
  '2026-07-22T10:05:00Z',
  '2026-07-22T10:05:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'unpublished_pending_sjp'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'unpublished'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'unpublished'),
  '00000000-0000-0000-0000-000000009911',
  '00000000-0000-0000-0000-000000009911',
  6,
  'Internal summit workshop seats',
  'Department planning and leadership review',
  'pending_approval',
  NULL,
  720.00,
  120.00,
  'Draft event request created for demo visibility',
  '2026-07-22T11:20:00Z',
  '2026-07-22T11:20:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'unpublished_pending_daksh'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'unpublished'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'unpublished'),
  '00000000-0000-0000-0000-000000009912',
  '00000000-0000-0000-0000-000000009912',
  4,
  'Ops planning seats',
  'Internal planning workshop',
  'pending_approval',
  NULL,
  480.00,
  120.00,
  'Second draft-event request for CEM demo',
  '2026-07-22T11:45:00Z',
  '2026-07-22T11:45:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'almost_full_confirmed_sjp'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'almost_full'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'almost_full'),
  '00000000-0000-0000-0000-000000009911',
  '00000000-0000-0000-0000-000000009911',
  8,
  'Key account hospitality',
  'Strategic Pepsi client hosting',
  'confirmed',
  NULL,
  2800.00,
  350.00,
  'Approved by Rachita',
  '2026-07-19T09:30:00Z',
  '2026-07-19T10:00:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'almost_full_confirmed_daksh'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'almost_full'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'almost_full'),
  '00000000-0000-0000-0000-000000009912',
  '00000000-0000-0000-0000-000000009912',
  12,
  'Channel partner hosting',
  'Top partner engagement',
  'confirmed',
  NULL,
  4200.00,
  350.00,
  'Invite sent, RSVP pending',
  '2026-07-19T10:10:00Z',
  '2026-07-19T10:45:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'almost_full_confirmed_meera'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'almost_full'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'almost_full'),
  '00000000-0000-0000-0000-000000009913',
  '00000000-0000-0000-0000-000000009913',
  14,
  'Marketing leadership hospitality',
  'Brand partnerships',
  'confirmed',
  NULL,
  4900.00,
  350.00,
  'Guest later declined RSVP',
  '2026-07-19T11:00:00Z',
  '2026-07-19T11:30:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'full_confirmed_sjp'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'full'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'full'),
  '00000000-0000-0000-0000-000000009911',
  '00000000-0000-0000-0000-000000009911',
  5,
  'Leadership dinner',
  'Executive hosting',
  'confirmed',
  NULL,
  2100.00,
  420.00,
  'Confirmed attendance',
  '2026-07-18T18:00:00Z',
  '2026-07-18T18:40:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'full_confirmed_daksh'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'full'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'full'),
  '00000000-0000-0000-0000-000000009912',
  '00000000-0000-0000-0000-000000009912',
  7,
  'Agency partner dinner',
  'Relationship management',
  'confirmed',
  NULL,
  2940.00,
  420.00,
  'Confirmed attendance',
  '2026-07-18T18:10:00Z',
  '2026-07-18T18:50:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'full_confirmed_meera'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'full'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'full'),
  '00000000-0000-0000-0000-000000009913',
  '00000000-0000-0000-0000-000000009913',
  8,
  'Brand showcase dinner',
  'Executive networking',
  'confirmed',
  NULL,
  3360.00,
  420.00,
  'Confirmed attendance',
  '2026-07-18T18:20:00Z',
  '2026-07-18T19:00:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'waitlisted_confirmed_sjp'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'waitlisted'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'waitlisted'),
  '00000000-0000-0000-0000-000000009911',
  '00000000-0000-0000-0000-000000009911',
  10,
  'Music client night',
  'VIP entertainment',
  'confirmed',
  NULL,
  2750.00,
  275.00,
  'Confirmed booking',
  '2026-07-17T19:00:00Z',
  '2026-07-17T19:20:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'waitlisted_confirmed_daksh'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'waitlisted'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'waitlisted'),
  '00000000-0000-0000-0000-000000009912',
  '00000000-0000-0000-0000-000000009912',
  10,
  'Partner entertainment',
  'VIP networking',
  'confirmed',
  NULL,
  2750.00,
  275.00,
  'Confirmed booking',
  '2026-07-17T19:10:00Z',
  '2026-07-17T19:30:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'waitlisted_waitlist_meera'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'waitlisted'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'waitlisted'),
  '00000000-0000-0000-0000-000000009913',
  '00000000-0000-0000-0000-000000009913',
  6,
  'Late VIP request',
  'Brand guest overflow',
  'waitlisted',
  1,
  1650.00,
  275.00,
  'Moved to waitlist because the event is full',
  '2026-07-22T08:40:00Z',
  '2026-07-22T08:40:00Z'
),
(
  (SELECT id FROM demo_booking_ids WHERE key = 'cancelled_cancelled_sjp'),
  '00000000-0000-0000-0000-000000000099',
  (SELECT id FROM demo_event_ids WHERE key = 'cancelled'),
  (SELECT id FROM demo_inventory_ids WHERE key = 'cancelled'),
  '00000000-0000-0000-0000-000000009911',
  '00000000-0000-0000-0000-000000009911',
  2,
  'Cancelled dinner',
  'Leadership engagement',
  'cancelled',
  NULL,
  600.00,
  300.00,
  'Cancelled after venue change',
  '2026-07-21T16:00:00Z',
  '2026-07-21T17:00:00Z'
);

INSERT INTO approval_request (
  id,
  booking_id,
  rule_id,
  approver_id,
  status,
  comments,
  created_at
) VALUES
(
  (SELECT id FROM demo_approval_ids WHERE key = 'available_pending_daksh'),
  (SELECT id FROM demo_booking_ids WHERE key = 'available_pending_daksh'),
  '78000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000009910',
  'pending',
  'Needs CEM approval before inviting external guests',
  '2026-07-22T09:16:00Z'
),
(
  (SELECT id FROM demo_approval_ids WHERE key = 'available_pending_meera'),
  (SELECT id FROM demo_booking_ids WHERE key = 'available_pending_meera'),
  '78000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000009910',
  'pending',
  'Awaiting line-manager approval',
  '2026-07-22T10:06:00Z'
),
(
  (SELECT id FROM demo_approval_ids WHERE key = 'unpublished_pending_sjp'),
  (SELECT id FROM demo_booking_ids WHERE key = 'unpublished_pending_sjp'),
  '78000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000009910',
  'pending',
  'Draft summit request awaiting Rachita review',
  '2026-07-22T11:21:00Z'
),
(
  (SELECT id FROM demo_approval_ids WHERE key = 'unpublished_pending_daksh'),
  (SELECT id FROM demo_booking_ids WHERE key = 'unpublished_pending_daksh'),
  '78000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000009910',
  'pending',
  'Second draft summit request for demo',
  '2026-07-22T11:46:00Z'
);

-- ---------------------------------------------------------------------------------------------
-- Guest list + invitations
-- ---------------------------------------------------------------------------------------------

INSERT INTO guest (
  id,
  tenant_id,
  first_name,
  last_name,
  email,
  company,
  created_at,
  updated_at
) VALUES
  ((SELECT id FROM demo_guest_ids WHERE key = 'almost_full_sjp'), '00000000-0000-0000-0000-000000000099', 'SJP', 'Selvaraj', 'sjp@pepsi.example.com', 'Pepsi', '2026-07-19T10:00:00Z', now()),
  ((SELECT id FROM demo_guest_ids WHERE key = 'almost_full_daksh'), '00000000-0000-0000-0000-000000000099', 'Daksh', 'Panchal', 'daksh.panchal@pepsi.example.com', 'Pepsi', '2026-07-19T10:45:00Z', now()),
  ((SELECT id FROM demo_guest_ids WHERE key = 'almost_full_meera'), '00000000-0000-0000-0000-000000000099', 'Meera', 'Iyer', 'meera.iyer@pepsi.example.com', 'Pepsi', '2026-07-19T11:30:00Z', now()),
  ((SELECT id FROM demo_guest_ids WHERE key = 'full_sjp'), '00000000-0000-0000-0000-000000000099', 'SJP', 'Selvaraj', 'sjp@pepsi.example.com', 'Pepsi', '2026-07-18T18:40:00Z', now()),
  ((SELECT id FROM demo_guest_ids WHERE key = 'full_daksh'), '00000000-0000-0000-0000-000000000099', 'Daksh', 'Panchal', 'daksh.panchal@pepsi.example.com', 'Pepsi', '2026-07-18T18:50:00Z', now()),
  ((SELECT id FROM demo_guest_ids WHERE key = 'full_meera'), '00000000-0000-0000-0000-000000000099', 'Meera', 'Iyer', 'meera.iyer@pepsi.example.com', 'Pepsi', '2026-07-18T19:00:00Z', now()),
  ((SELECT id FROM demo_guest_ids WHERE key = 'waitlisted_sjp'), '00000000-0000-0000-0000-000000000099', 'SJP', 'Selvaraj', 'sjp@pepsi.example.com', 'Pepsi', '2026-07-17T19:20:00Z', now()),
  ((SELECT id FROM demo_guest_ids WHERE key = 'waitlisted_daksh'), '00000000-0000-0000-0000-000000000099', 'Daksh', 'Panchal', 'daksh.panchal@pepsi.example.com', 'Pepsi', '2026-07-17T19:30:00Z', now());

INSERT INTO invitation (
  id,
  booking_id,
  guest_id,
  status,
  rsvp_at,
  sent_at,
  attended,
  created_at,
  updated_at
) VALUES
  ((SELECT id FROM demo_invitation_ids WHERE key = 'almost_full_sjp'), (SELECT id FROM demo_booking_ids WHERE key = 'almost_full_confirmed_sjp'), (SELECT id FROM demo_guest_ids WHERE key = 'almost_full_sjp'), 'accepted', '2026-07-20T08:10:00Z', '2026-07-19T10:05:00Z', false, '2026-07-19T10:05:00Z', now()),
  ((SELECT id FROM demo_invitation_ids WHERE key = 'almost_full_daksh'), (SELECT id FROM demo_booking_ids WHERE key = 'almost_full_confirmed_daksh'), (SELECT id FROM demo_guest_ids WHERE key = 'almost_full_daksh'), 'sent', NULL, '2026-07-19T10:50:00Z', false, '2026-07-19T10:50:00Z', now()),
  ((SELECT id FROM demo_invitation_ids WHERE key = 'almost_full_meera'), (SELECT id FROM demo_booking_ids WHERE key = 'almost_full_confirmed_meera'), (SELECT id FROM demo_guest_ids WHERE key = 'almost_full_meera'), 'declined', '2026-07-21T09:15:00Z', '2026-07-19T11:35:00Z', false, '2026-07-19T11:35:00Z', now()),
  ((SELECT id FROM demo_invitation_ids WHERE key = 'full_sjp'), (SELECT id FROM demo_booking_ids WHERE key = 'full_confirmed_sjp'), (SELECT id FROM demo_guest_ids WHERE key = 'full_sjp'), 'accepted', '2026-07-19T08:00:00Z', '2026-07-18T18:45:00Z', false, '2026-07-18T18:45:00Z', now()),
  ((SELECT id FROM demo_invitation_ids WHERE key = 'full_daksh'), (SELECT id FROM demo_booking_ids WHERE key = 'full_confirmed_daksh'), (SELECT id FROM demo_guest_ids WHERE key = 'full_daksh'), 'accepted', '2026-07-19T08:20:00Z', '2026-07-18T18:55:00Z', false, '2026-07-18T18:55:00Z', now()),
  ((SELECT id FROM demo_invitation_ids WHERE key = 'full_meera'), (SELECT id FROM demo_booking_ids WHERE key = 'full_confirmed_meera'), (SELECT id FROM demo_guest_ids WHERE key = 'full_meera'), 'sent', NULL, '2026-07-18T19:05:00Z', false, '2026-07-18T19:05:00Z', now()),
  ((SELECT id FROM demo_invitation_ids WHERE key = 'waitlisted_sjp'), (SELECT id FROM demo_booking_ids WHERE key = 'waitlisted_confirmed_sjp'), (SELECT id FROM demo_guest_ids WHERE key = 'waitlisted_sjp'), 'accepted', '2026-07-18T09:20:00Z', '2026-07-17T19:25:00Z', false, '2026-07-17T19:25:00Z', now()),
  ((SELECT id FROM demo_invitation_ids WHERE key = 'waitlisted_daksh'), (SELECT id FROM demo_booking_ids WHERE key = 'waitlisted_confirmed_daksh'), (SELECT id FROM demo_guest_ids WHERE key = 'waitlisted_daksh'), 'accepted', '2026-07-18T09:30:00Z', '2026-07-17T19:35:00Z', false, '2026-07-17T19:35:00Z', now());

INSERT INTO invitation_audit (
  id,
  invitation_id,
  changed_by_id,
  field_changed,
  old_value,
  new_value,
  changed_at
) VALUES
  (gen_random_uuid(), (SELECT id FROM demo_invitation_ids WHERE key = 'almost_full_sjp'), '00000000-0000-0000-0000-000000009910', 'status', 'sent', 'accepted', '2026-07-20T08:10:00Z'),
  (gen_random_uuid(), (SELECT id FROM demo_invitation_ids WHERE key = 'almost_full_meera'), '00000000-0000-0000-0000-000000009913', 'status', 'sent', 'declined', '2026-07-21T09:15:00Z'),
  (gen_random_uuid(), (SELECT id FROM demo_invitation_ids WHERE key = 'full_sjp'), '00000000-0000-0000-0000-000000009910', 'status', 'sent', 'accepted', '2026-07-19T08:00:00Z'),
  (gen_random_uuid(), (SELECT id FROM demo_invitation_ids WHERE key = 'waitlisted_sjp'), '00000000-0000-0000-0000-000000009910', 'status', 'sent', 'accepted', '2026-07-18T09:20:00Z');

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
  (SELECT id FROM demo_enquiry_ids WHERE key = 'submitted'),
  '00000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000009911',
  '00000000-0000-0000-0000-000000009910',
  'PEP-ENQ-1001',
  'Corporate Hospitality',
  'Corporate Hospitality',
  'Client relationship building',
  'Pepsi client hospitality request',
  '2026-08-14',
  'London',
  18000.00,
  'GBP',
  12,
  'Need premium football hospitality for top accounts',
  'submitted',
  ARRAY[]::varchar[],
  '2026-07-21T09:00:00Z',
  '2026-07-21T09:00:00Z'
),
(
  (SELECT id FROM demo_enquiry_ids WHERE key = 'proposal_received'),
  '00000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000009912',
  '00000000-0000-0000-0000-000000009910',
  'PEP-ENQ-1002',
  'Private Dining',
  'Private Dining',
  'Executive dinner',
  'Pepsi leadership dinner proposal',
  '2026-08-20',
  'London',
  12000.00,
  'GBP',
  10,
  'Proposal already received from venue',
  'proposal_received',
  ARRAY[]::varchar[],
  '2026-07-20T11:30:00Z',
  '2026-07-22T08:00:00Z'
),
(
  (SELECT id FROM demo_enquiry_ids WHERE key = 'in_progress'),
  '00000000-0000-0000-0000-000000000099',
  '00000000-0000-0000-0000-000000009913',
  '00000000-0000-0000-0000-000000009910',
  'PEP-ENQ-1003',
  'Tickets',
  'Tickets',
  'Partner reward',
  'Summer concert tickets',
  '2026-08-10',
  'London',
  4000.00,
  'GBP',
  6,
  'Need six concert tickets for partner incentives',
  'in_progress',
  ARRAY[]::varchar[],
  '2026-07-19T15:00:00Z',
  '2026-07-22T09:45:00Z'
);

-- ---------------------------------------------------------------------------------------------
-- Audit trail for event detail popovers
-- ---------------------------------------------------------------------------------------------

INSERT INTO audit_log (
  id,
  tenant_id,
  actor,
  action,
  entity_type,
  entity_id,
  metadata,
  created_at
) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.created', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'available'), '{"eventId": null, "status": "available"}'::jsonb, '2026-07-18T08:00:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.published', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'available'), '{"eventId": null, "groups": ["All Users"]}'::jsonb, '2026-07-18T08:05:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009912', 'booking.requested', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'available_pending_daksh'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'available'), 'seatsRequested', 4), '2026-07-22T09:15:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009913', 'booking.requested', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'available_pending_meera'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'available'), 'seatsRequested', 3), '2026-07-22T10:05:00Z'),

  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.created', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'almost_full'), '{"source": "company-sourced"}'::jsonb, '2026-07-16T08:30:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.published', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'almost_full'), '{"groups": ["All Users"]}'::jsonb, '2026-07-16T08:35:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009911', 'booking.requested', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'almost_full_confirmed_sjp'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'almost_full'), 'seatsRequested', 8), '2026-07-19T09:30:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'booking.approved', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'almost_full_confirmed_sjp'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'almost_full')), '2026-07-19T10:00:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'invitation.sent', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'almost_full_confirmed_sjp'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'almost_full'), 'invitationId', (SELECT id::text FROM demo_invitation_ids WHERE key = 'almost_full_sjp')), '2026-07-19T10:05:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009911', 'invitation.rsvp.accepted', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'almost_full_confirmed_sjp'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'almost_full'), 'previous', 'sent', 'next', 'accepted'), '2026-07-20T08:10:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009913', 'invitation.rsvp.declined', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'almost_full_confirmed_meera'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'almost_full'), 'previous', 'sent', 'next', 'declined'), '2026-07-21T09:15:00Z'),

  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.created', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'full'), '{"status": "full"}'::jsonb, '2026-07-14T10:00:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.published', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'full'), '{"groups": ["All Users"]}'::jsonb, '2026-07-14T10:05:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.created', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'waitlisted'), '{"status": "waitlisted"}'::jsonb, '2026-07-12T08:00:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009913', 'booking.requested', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'waitlisted_waitlist_meera'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'waitlisted'), 'seatsRequested', 6, 'waitlistPosition', 1), '2026-07-22T08:40:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.cancelled', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'cancelled'), '{"reason": "Venue not available"}'::jsonb, '2026-07-21T17:00:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009910', 'listing.unpublished', 'event', (SELECT id::text FROM demo_event_ids WHERE key = 'unpublished'), '{"reason": "Awaiting final review"}'::jsonb, '2026-07-20T09:05:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009911', 'booking.requested', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'unpublished_pending_sjp'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'unpublished'), 'seatsRequested', 6), '2026-07-22T11:20:00Z'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000009912', 'booking.requested', 'booking', (SELECT id::text FROM demo_booking_ids WHERE key = 'unpublished_pending_daksh'), jsonb_build_object('eventId', (SELECT id::text FROM demo_event_ids WHERE key = 'unpublished'), 'seatsRequested', 4), '2026-07-22T11:45:00Z');

COMMIT;

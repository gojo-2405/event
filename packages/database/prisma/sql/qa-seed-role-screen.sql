-- QA fix: role_screen table is empty, so authenticated users get `screens: []` and the app
-- renders a blank page after login. This seeds the screen catalogue (idempotent) and the
-- role/screen access matrix for CEM + Requester, matching rbac-foundation.sql. Safe to re-run.
--
--   psql "$DATABASE_URL" -f packages/database/prisma/sql/qa-seed-role-screen.sql
--
-- Assumes rbac-foundation.sql already ran (role, screen, role_screen tables + the `cem`/
-- `requestor` role rows exist). If `screen` is already populated, those inserts no-op.

BEGIN;

-- Screen catalogue (no-ops if already present).
INSERT INTO screen (id, key, title, path, icon, section, sort_order) VALUES
  ('50000000-0000-0000-0000-000000000001', 'dashboard',      'Dashboard',           '/',                    'LayoutDashboard', 'Management', 1),
  ('50000000-0000-0000-0000-000000000002', 'listing',        'Listing',             '/events',              'Calendar',        'Management', 2),
  ('50000000-0000-0000-0000-000000000003', 'enquiries',      'Enquiries',           '/enquiries',           'Inbox',           'Management', 3),
  ('50000000-0000-0000-0000-000000000004', 'approvals',      'Approvals',           '/approvals',           'ShieldCheck',     'Management', 4),
  ('50000000-0000-0000-0000-000000000005', 'venue-sourcing', 'Venue Sourcing',      '/venue-sourcing',      'Handshake',       'Management', 5),
  ('50000000-0000-0000-0000-000000000006', 'reports',        'Reports',             '/reports',             'FileBarChart2',   'Management', 6),
  ('50000000-0000-0000-0000-000000000007', 'users',          'Users & Permissions', '/users',               'UserCog',         'Management', 7),
  ('50000000-0000-0000-0000-000000000008', 'delegations',    'Delegations',         '/users/delegations',   'Users',           'Management', 8),
  ('50000000-0000-0000-0000-000000000009', 'audit',          'Audit Trail',         '/audit',               'ScrollText',      'Management', 9),
  ('50000000-0000-0000-0000-00000000000a', 'analytics',      'Analytics',           '/analytics',           'BarChart3',       'Management', 10),
  ('50000000-0000-0000-0000-000000000101', 'requester-home', 'Requester Home',      '/requester',           'LayoutDashboard', 'Requester', 1),
  ('50000000-0000-0000-0000-000000000102', 'browse',         'Browse Events',       '/requester/browse',    'Compass',         'Requester', 2),
  ('50000000-0000-0000-0000-000000000103', 'bookings',       'My Bookings',         '/requester/bookings',  'CalendarCheck',   'Requester', 3),
  ('50000000-0000-0000-0000-000000000104', 'my-enquiries',   'My Enquiries',        '/requester/enquiries', 'Inbox',           'Requester', 4),
  ('50000000-0000-0000-0000-000000000105', 'wishlist',       'Wishlist',            '/requester/wishlist',  'Heart',           'Requester', 5),
  ('50000000-0000-0000-0000-000000000106', 'profile',        'Profile',             '/requester/profile',   'User',            'Requester', 6),
  ('50000000-0000-0000-0000-000000000107', 'support',        'Requester Support',   '/requester/support',   'LifeBuoy',        'Requester', 7)
ON CONFLICT (key) DO NOTHING;

-- CEM access matrix.
INSERT INTO role_screen (role_id, screen_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, s.id, true,
       s.key IN ('listing'),                       -- can_create
       s.key IN ('listing','enquiries'),           -- can_edit
       false,                                       -- can_delete
       s.key IN ('listing','enquiries')            -- can_approve (publish/approve bookings)
FROM role r, screen s
WHERE r.key = 'cem' AND s.key IN ('dashboard','listing','enquiries')
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Requester access matrix.
INSERT INTO role_screen (role_id, screen_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, s.id, true,
       s.key IN ('bookings','my-enquiries'),        -- can_create (book / submit enquiry)
       false, false, false
FROM role r, screen s
WHERE r.key = 'requestor' AND s.key IN ('requester-home','browse','bookings','my-enquiries')
ON CONFLICT (role_id, screen_id) DO NOTHING;

COMMIT;

-- Verify (expect: cem -> 3 rows, requestor -> 4 rows).
SELECT r.key AS role, count(*) AS screens
FROM role_screen rs JOIN role r ON r.id = rs.role_id
GROUP BY r.key ORDER BY r.key;

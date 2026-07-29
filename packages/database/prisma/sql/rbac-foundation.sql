-- RBAC foundation: DB-driven roles + screens + role/screen access matrix, plus password auth.
-- Roles and screens are data (not code), so the sidebar and route access are configured here and
-- rendered dynamically in the frontend from GET /auth/me.

CREATE TABLE IF NOT EXISTS role (
  id          uuid PRIMARY KEY,
  key         varchar NOT NULL UNIQUE,
  label       varchar NOT NULL,
  description varchar,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A "screen" is both a navigation entry and a routable page. section/sort_order drive the
-- grouped sidebar; path is the frontend route; icon is a lucide icon key resolved client-side.
CREATE TABLE IF NOT EXISTS screen (
  id          uuid PRIMARY KEY,
  key         varchar NOT NULL UNIQUE,
  title       varchar NOT NULL,
  path        varchar NOT NULL,
  icon        varchar,
  section     varchar,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The authorization matrix: which roles can see/act on which screens.
CREATE TABLE IF NOT EXISTS role_screen (
  role_id     uuid NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  screen_id   uuid NOT NULL REFERENCES screen(id) ON DELETE CASCADE,
  can_view    boolean NOT NULL DEFAULT true,
  can_create  boolean NOT NULL DEFAULT false,
  can_edit    boolean NOT NULL DEFAULT false,
  can_delete  boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, screen_id)
);

-- Password auth + link app_user to a configurable role. (The legacy user_role enum column stays
-- for existing data; role_id is the new source of truth for login/authorization.)
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS password_hash varchar,
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES role(id);

CREATE INDEX IF NOT EXISTS idx_app_user_role ON app_user (role_id);

-- ---------------------------------------------------------------------------------------------
-- Seed: roles
INSERT INTO role (id, key, label, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'cem', 'CEM (Management)', 'Client Event Manager — management console'),
  ('a0000000-0000-0000-0000-000000000002', 'requestor', 'Requester', 'Employee who browses and books events')
ON CONFLICT (key) DO NOTHING;

-- Seed: screens (all known screens; visibility is controlled by role_screen below)
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

-- Seed: role_screen matrix (only the currently-active screens are granted; the rest exist but
-- are unmapped, so they stay hidden — matching the current commented-out menu state).
-- CEM
INSERT INTO role_screen (role_id, screen_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, s.id, true,
       s.key IN ('listing'),                       -- can_create
       s.key IN ('listing','enquiries'),           -- can_edit
       false,                                       -- can_delete
       s.key IN ('listing','enquiries')            -- can_approve (publish/approve bookings)
FROM role r, screen s
WHERE r.key = 'cem' AND s.key IN ('dashboard','listing','enquiries')
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Requester
INSERT INTO role_screen (role_id, screen_id, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, s.id, true,
       s.key IN ('bookings','my-enquiries'),        -- can_create (book / submit enquiry)
       false, false, false
FROM role r, screen s
WHERE r.key = 'requestor' AND s.key IN ('requester-home','browse','bookings','my-enquiries')
ON CONFLICT (role_id, screen_id) DO NOTHING;

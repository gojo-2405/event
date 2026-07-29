-- Eventrax tenant isolation scaffold
-- Source: etx.sql confirmed as final schema

-- Session variables expected from app code:
--   app.tenant_id   UUID string
--   app.bypass_rls  true|false

CREATE OR REPLACE FUNCTION app_is_bypass_rls()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), 'false') = 'true';
$$;

CREATE OR REPLACE FUNCTION app_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

-- Direct tenant-owned tables
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE event ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiry ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_tenant_policy ON app_user
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

CREATE POLICY entitlement_tenant_policy ON entitlement
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

CREATE POLICY entitlement_ledger_tenant_policy ON entitlement_ledger
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

CREATE POLICY event_tenant_policy ON event
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

CREATE POLICY booking_tenant_policy ON booking
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

CREATE POLICY approval_rule_tenant_policy ON approval_rule
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

CREATE POLICY guest_tenant_policy ON guest
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

CREATE POLICY enquiry_tenant_policy ON enquiry
  USING (app_is_bypass_rls() OR tenant_id = app_current_tenant_id());

-- Derived tables should use join-based tenant policies in the first full migration pass.
-- Examples:
--   inventory_item via event.tenant_id
--   approval_request via booking.tenant_id
--   invitation via booking.tenant_id
--   enquiry_proposal via enquiry.tenant_id or booking.tenant_id

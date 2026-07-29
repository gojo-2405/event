-- E20-59: GDPR Data Retention + Purge.
CREATE TABLE IF NOT EXISTS retention_policy (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  entity varchar NOT NULL,
  retain_days integer NOT NULL,
  mode varchar NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  actor varchar NOT NULL,
  action varchar NOT NULL,
  entity_type varchar,
  entity_id varchar,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_entity
  ON audit_log (tenant_id, entity_type, entity_id);

-- Erasure/purge audit rows must themselves never be purged or edited — mirrors
-- prevent_invitation_audit_mutation() from immutable-audit.sql (E20-22).
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON audit_log;

CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

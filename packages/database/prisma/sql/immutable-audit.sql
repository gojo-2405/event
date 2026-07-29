CREATE OR REPLACE FUNCTION prevent_invitation_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'invitation_audit is immutable; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invitation_audit_mutation ON invitation_audit;

CREATE TRIGGER trg_prevent_invitation_audit_mutation
BEFORE UPDATE OR DELETE ON invitation_audit
FOR EACH ROW
EXECUTE FUNCTION prevent_invitation_audit_mutation();

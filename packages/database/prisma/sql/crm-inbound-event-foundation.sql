CREATE TABLE IF NOT EXISTS crm_inbound_event (
  id uuid PRIMARY KEY,
  tenant_id uuid,
  flow varchar NOT NULL,
  external_ref varchar,
  idempotency_key varchar NOT NULL UNIQUE,
  signature_valid boolean NOT NULL,
  raw_payload jsonb NOT NULL,
  status varchar NOT NULL DEFAULT 'received',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 4,
  next_attempt_at timestamptz,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_inbound_event_status_next_attempt
  ON crm_inbound_event (status, next_attempt_at);

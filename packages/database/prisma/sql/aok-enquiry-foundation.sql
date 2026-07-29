ALTER TABLE enquiry
  ADD COLUMN IF NOT EXISTS crm_ref varchar;

CREATE TABLE IF NOT EXISTS enquiry_dispatch (
  id uuid PRIMARY KEY,
  enquiry_id uuid NOT NULL REFERENCES enquiry(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  provider varchar NOT NULL,
  dispatch_key varchar NOT NULL UNIQUE,
  target_mode varchar NOT NULL,
  target_contact_ref integer,
  crm_ref varchar,
  status varchar NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  payload jsonb,
  response_payload jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enquiry_dispatch_status_next_attempt
  ON enquiry_dispatch (status, next_attempt_at);

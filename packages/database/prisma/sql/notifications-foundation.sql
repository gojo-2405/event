CREATE TABLE IF NOT EXISTS notification (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenant(id) DEFERRABLE INITIALLY IMMEDIATE,
  user_id uuid REFERENCES app_user(id) DEFERRABLE INITIALLY IMMEDIATE,
  type varchar NOT NULL,
  title varchar NOT NULL,
  message text NOT NULL,
  status varchar NOT NULL DEFAULT 'unread',
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_tenant_user_status
  ON notification (tenant_id, user_id, status);

CREATE TABLE IF NOT EXISTS notification_job (
  id uuid PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES notification(id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  tenant_id uuid REFERENCES tenant(id) DEFERRABLE INITIALLY IMMEDIATE,
  channel varchar NOT NULL,
  recipient_email varchar,
  template_key varchar,
  payload jsonb,
  idempotency_key varchar NOT NULL UNIQUE,
  status varchar NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 4,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_job_status_next_attempt
  ON notification_job (status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_notification_job_tenant_status
  ON notification_job (tenant_id, status);

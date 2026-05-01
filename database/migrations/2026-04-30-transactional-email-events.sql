DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_event_status') THEN
    CREATE TYPE email_event_status AS ENUM ('pending','sent','skipped','failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  org_id              UUID REFERENCES organisations(id) ON DELETE CASCADE,
  recipient           TEXT NOT NULL,
  email_type          TEXT NOT NULL,
  provider            TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status              email_event_status NOT NULL DEFAULT 'pending',
  idempotency_key     TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  error               TEXT,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_events_org_idx ON email_events(org_id, created_at);
CREATE INDEX IF NOT EXISTS email_events_user_idx ON email_events(user_id);
CREATE INDEX IF NOT EXISTS email_events_type_idx ON email_events(email_type);
CREATE INDEX IF NOT EXISTS email_events_status_idx ON email_events(status);
CREATE UNIQUE INDEX IF NOT EXISTS email_events_idempotency_unique ON email_events(idempotency_key);

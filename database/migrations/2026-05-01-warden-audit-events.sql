CREATE TABLE IF NOT EXISTS warden_audit_event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  surface         TEXT NOT NULL,
  source_type     TEXT NOT NULL,
  action          TEXT NOT NULL,
  verdict         TEXT NOT NULL,
  risk_level      TEXT NOT NULL,
  categories      JSONB NOT NULL DEFAULT '[]',
  reasons         JSONB NOT NULL DEFAULT '[]',
  content_hash    TEXT,
  redaction_count INTEGER NOT NULL DEFAULT 0,
  source_url      TEXT,
  file_id         TEXT,
  tool_name       TEXT,
  provider        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS warden_audit_org_idx ON warden_audit_event(org_id, created_at);
CREATE INDEX IF NOT EXISTS warden_audit_surface_idx ON warden_audit_event(surface);
CREATE INDEX IF NOT EXISTS warden_audit_verdict_idx ON warden_audit_event(verdict);
CREATE INDEX IF NOT EXISTS warden_audit_risk_idx ON warden_audit_event(risk_level);
CREATE INDEX IF NOT EXISTS warden_audit_tool_idx ON warden_audit_event(tool_name);

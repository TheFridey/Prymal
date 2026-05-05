-- Migration: P3 action approvals
-- Must run before deploying the action runtime (P3).

CREATE TABLE IF NOT EXISTS action_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  verdict     TEXT,
  workflow_id TEXT,
  node_id     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_approvals_token ON action_approvals(token_hash);
CREATE INDEX IF NOT EXISTS idx_action_approvals_org   ON action_approvals(org_id, created_at DESC);

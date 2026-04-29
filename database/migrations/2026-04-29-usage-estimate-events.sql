-- usage_estimate_events: append-only ledger for margin observability & admin economics
-- Compatible with Prymal plan enums (text plan_key mirrors organisations.plan).

CREATE TABLE IF NOT EXISTS usage_estimate_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id                  TEXT REFERENCES users(id) ON DELETE SET NULL,
  subscription_id           UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_key                 TEXT NOT NULL,
  action_type               TEXT NOT NULL,
  cost_class                TEXT NOT NULL,
  estimated_gbp_cost        DOUBLE PRECISION NOT NULL DEFAULT 0,
  credit_cost               INTEGER NOT NULL DEFAULT 0,
  provider                  TEXT,
  model                     TEXT,
  reference_kind            TEXT,
  reference_id              UUID,
  metadata                  JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_estimate_events_org_created_idx
  ON usage_estimate_events(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_estimate_events_created_idx
  ON usage_estimate_events(created_at DESC);
CREATE INDEX IF NOT EXISTS usage_estimate_events_user_created_idx
  ON usage_estimate_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS usage_estimate_events_action_idx
  ON usage_estimate_events(action_type, created_at DESC);

COMMENT ON TABLE usage_estimate_events IS 'Append-only estimated provider cost per billable action; does not replace subscription cumulative burn.';

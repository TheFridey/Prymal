-- Migration: 2026-04-23-billing-credit-schema
-- Reconciles legacy local databases with the current billing/credit source-of-truth schema.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan                           plan NOT NULL DEFAULT 'free',
  status                         TEXT NOT NULL DEFAULT 'active',
  billing_interval               TEXT NOT NULL DEFAULT 'monthly',
  current_period_start           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end             TIMESTAMPTZ,
  last_reset_at                  TIMESTAMPTZ,
  execution_included_balance     INTEGER NOT NULL DEFAULT 50,
  execution_purchased_balance    INTEGER NOT NULL DEFAULT 0,
  execution_reserved_balance     INTEGER NOT NULL DEFAULT 0,
  video_included_balance         INTEGER NOT NULL DEFAULT 0,
  video_purchased_balance        INTEGER NOT NULL DEFAULT 0,
  video_reserved_balance         INTEGER NOT NULL DEFAULT 0,
  cumulative_revenue_gbp         REAL NOT NULL DEFAULT 0,
  cumulative_estimated_cost_usd  REAL NOT NULL DEFAULT 0,
  cost_guard_state               TEXT NOT NULL DEFAULT 'normal',
  metadata                       JSONB NOT NULL DEFAULT '{}',
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_plan_idx ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS subscriptions_period_idx ON subscriptions(current_period_end);

CREATE TABLE IF NOT EXISTS credit_ledger_execution (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subscription_id         UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  purchase_id             UUID,
  usage_event_id          UUID,
  source                  TEXT NOT NULL,
  entry_type              TEXT NOT NULL DEFAULT 'adjustment',
  delta                   INTEGER NOT NULL,
  balance_after           INTEGER NOT NULL,
  included_balance_after  INTEGER NOT NULL,
  purchased_balance_after INTEGER NOT NULL,
  reserved_balance_after  INTEGER NOT NULL DEFAULT 0,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_ledger_execution_org_idx ON credit_ledger_execution(org_id);
CREATE INDEX IF NOT EXISTS credit_ledger_execution_subscription_idx ON credit_ledger_execution(subscription_id);
CREATE INDEX IF NOT EXISTS credit_ledger_execution_source_idx ON credit_ledger_execution(source);
CREATE INDEX IF NOT EXISTS credit_ledger_execution_created_idx ON credit_ledger_execution(created_at);
CREATE INDEX IF NOT EXISTS credit_ledger_execution_usage_idx ON credit_ledger_execution(usage_event_id);

CREATE TABLE IF NOT EXISTS credit_ledger_video (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subscription_id         UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  purchase_id             UUID,
  usage_event_id          UUID,
  source                  TEXT NOT NULL,
  entry_type              TEXT NOT NULL DEFAULT 'adjustment',
  delta                   INTEGER NOT NULL,
  balance_after           INTEGER NOT NULL,
  included_balance_after  INTEGER NOT NULL,
  purchased_balance_after INTEGER NOT NULL,
  reserved_balance_after  INTEGER NOT NULL DEFAULT 0,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_ledger_video_org_idx ON credit_ledger_video(org_id);
CREATE INDEX IF NOT EXISTS credit_ledger_video_subscription_idx ON credit_ledger_video(subscription_id);
CREATE INDEX IF NOT EXISTS credit_ledger_video_source_idx ON credit_ledger_video(source);
CREATE INDEX IF NOT EXISTS credit_ledger_video_created_idx ON credit_ledger_video(created_at);
CREATE INDEX IF NOT EXISTS credit_ledger_video_usage_idx ON credit_ledger_video(usage_event_id);

CREATE TABLE IF NOT EXISTS execution_usage_event (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id                   TEXT REFERENCES users(id) ON DELETE SET NULL,
  conversation_id           UUID,
  workflow_run_id           UUID,
  agent_id                  agent_id NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'reserved',
  request_id                TEXT,
  base_credits              INTEGER NOT NULL DEFAULT 1,
  estimated_context_tokens  INTEGER NOT NULL DEFAULT 0,
  context_multiplier        REAL NOT NULL DEFAULT 1,
  agent_count               INTEGER NOT NULL DEFAULT 1,
  agent_multiplier          REAL NOT NULL DEFAULT 1,
  credits_reserved          INTEGER NOT NULL DEFAULT 0,
  credits_committed         INTEGER NOT NULL DEFAULT 0,
  prompt_tokens             INTEGER,
  completion_tokens         INTEGER,
  total_tokens              INTEGER,
  estimated_cost_usd        REAL,
  revenue_contribution_gbp  REAL,
  cost_guard_triggered      BOOLEAN NOT NULL DEFAULT false,
  heavy_usage_flagged       BOOLEAN NOT NULL DEFAULT false,
  provider                  TEXT,
  model                     TEXT,
  metadata                  JSONB NOT NULL DEFAULT '{}',
  started_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_usage_event_org_idx ON execution_usage_event(org_id);
CREATE INDEX IF NOT EXISTS execution_usage_event_status_idx ON execution_usage_event(status);
CREATE INDEX IF NOT EXISTS execution_usage_event_created_idx ON execution_usage_event(created_at);
CREATE INDEX IF NOT EXISTS execution_usage_event_request_idx ON execution_usage_event(request_id);
CREATE INDEX IF NOT EXISTS execution_usage_event_conversation_idx ON execution_usage_event(conversation_id);

CREATE TABLE IF NOT EXISTS video_generation_event (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id              TEXT REFERENCES users(id) ON DELETE SET NULL,
  conversation_id      UUID,
  message_id           UUID,
  status               TEXT NOT NULL DEFAULT 'queued',
  provider             TEXT NOT NULL DEFAULT 'google',
  model                TEXT NOT NULL,
  prompt               TEXT NOT NULL,
  duration_seconds     INTEGER NOT NULL,
  resolution           TEXT NOT NULL,
  aspect_ratio         TEXT NOT NULL,
  credits_requested    INTEGER NOT NULL DEFAULT 0,
  credits_reserved     INTEGER NOT NULL DEFAULT 0,
  credits_committed    INTEGER NOT NULL DEFAULT 0,
  retry_count          INTEGER NOT NULL DEFAULT 0,
  max_retries          INTEGER NOT NULL DEFAULT 2,
  provider_job_id      TEXT,
  output_url           TEXT,
  output_file_name     TEXT,
  failure_code         TEXT,
  failure_message      TEXT,
  heavy_usage_flagged  BOOLEAN NOT NULL DEFAULT false,
  provider_metadata    JSONB NOT NULL DEFAULT '{}',
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_generation_event_org_idx ON video_generation_event(org_id);
CREATE INDEX IF NOT EXISTS video_generation_event_status_idx ON video_generation_event(status);
CREATE INDEX IF NOT EXISTS video_generation_event_created_idx ON video_generation_event(created_at);
CREATE INDEX IF NOT EXISTS video_generation_event_provider_job_idx ON video_generation_event(provider_job_id);
CREATE INDEX IF NOT EXISTS video_generation_event_conversation_idx ON video_generation_event(conversation_id);

CREATE TABLE IF NOT EXISTS credit_purchase (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subscription_id            UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  credit_type                TEXT NOT NULL,
  pack_id                    TEXT NOT NULL,
  credits                    INTEGER NOT NULL,
  amount_gbp                 REAL NOT NULL,
  currency                   TEXT NOT NULL DEFAULT 'gbp',
  status                     TEXT NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,
  stripe_invoice_id          TEXT,
  metadata                   JSONB NOT NULL DEFAULT '{}',
  completed_at               TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (stripe_checkout_session_id)
);

CREATE INDEX IF NOT EXISTS credit_purchase_org_idx ON credit_purchase(org_id);
CREATE INDEX IF NOT EXISTS credit_purchase_type_idx ON credit_purchase(credit_type);
CREATE INDEX IF NOT EXISTS credit_purchase_status_idx ON credit_purchase(status);

CREATE TABLE IF NOT EXISTS threshold_state (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  credit_type        TEXT NOT NULL,
  cycle_key          TEXT NOT NULL,
  threshold_percent  INTEGER NOT NULL DEFAULT 0,
  last_triggered_at  TIMESTAMPTZ,
  acknowledged_at    TIMESTAMPTZ,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, credit_type, cycle_key)
);

CREATE INDEX IF NOT EXISTS threshold_state_org_idx ON threshold_state(org_id);
CREATE INDEX IF NOT EXISTS threshold_state_cycle_idx ON threshold_state(credit_type, cycle_key);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at'
  ) THEN
    IF to_regclass('public.subscriptions') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subscriptions_updated_at' AND tgrelid = 'public.subscriptions'::regclass) THEN
      CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF to_regclass('public.execution_usage_event') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'execution_usage_event_updated_at' AND tgrelid = 'public.execution_usage_event'::regclass) THEN
      CREATE TRIGGER execution_usage_event_updated_at BEFORE UPDATE ON execution_usage_event FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF to_regclass('public.video_generation_event') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'video_generation_event_updated_at' AND tgrelid = 'public.video_generation_event'::regclass) THEN
      CREATE TRIGGER video_generation_event_updated_at BEFORE UPDATE ON video_generation_event FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF to_regclass('public.credit_purchase') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'credit_purchase_updated_at' AND tgrelid = 'public.credit_purchase'::regclass) THEN
      CREATE TRIGGER credit_purchase_updated_at BEFORE UPDATE ON credit_purchase FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF to_regclass('public.threshold_state') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'threshold_state_updated_at' AND tgrelid = 'public.threshold_state'::regclass) THEN
      CREATE TRIGGER threshold_state_updated_at BEFORE UPDATE ON threshold_state FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
  END IF;
END $$;

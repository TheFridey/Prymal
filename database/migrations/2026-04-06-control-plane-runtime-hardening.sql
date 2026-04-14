CREATE TABLE IF NOT EXISTS admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id),
  actor_staff_role TEXT NOT NULL,
  action TEXT NOT NULL,
  permission TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason_code TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_action_logs_org_idx ON admin_action_logs(org_id);
CREATE INDEX IF NOT EXISTS admin_action_logs_action_idx ON admin_action_logs(action);
CREATE INDEX IF NOT EXISTS admin_action_logs_staff_role_idx ON admin_action_logs(actor_staff_role);
CREATE INDEX IF NOT EXISTS admin_action_logs_created_idx ON admin_action_logs(created_at);

CREATE TABLE IF NOT EXISTS credit_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id),
  delta INTEGER NOT NULL,
  previous_credits_used INTEGER NOT NULL,
  next_credits_used INTEGER NOT NULL,
  reason_code TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_adjustments_org_idx ON credit_adjustments(org_id);
CREATE INDEX IF NOT EXISTS credit_adjustments_actor_idx ON credit_adjustments(actor_user_id);
CREATE INDEX IF NOT EXISTS credit_adjustments_created_idx ON credit_adjustments(created_at);

CREATE TABLE IF NOT EXISTS organisation_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, flag_key)
);

CREATE INDEX IF NOT EXISTS org_feature_flags_org_idx ON organisation_feature_flags(org_id);

ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'inline';
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS failure_class TEXT;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMPTZ;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS replay_of_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS runs_idempotency_idx ON workflow_runs(workflow_id, idempotency_key);
CREATE INDEX IF NOT EXISTS runs_status_idx ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS runs_failure_class_idx ON workflow_runs(failure_class);

CREATE TABLE IF NOT EXISTS llm_execution_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  agent_id agent_id NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  policy_key TEXT NOT NULL,
  route TEXT NOT NULL,
  route_reason TEXT,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost_usd REAL,
  tools_used TEXT[] NOT NULL DEFAULT '{}'::text[],
  lore_chunk_ids UUID[],
  lore_document_ids UUID[],
  memory_read_ids UUID[],
  memory_write_keys TEXT[] NOT NULL DEFAULT '{}'::text[],
  outcome_status TEXT NOT NULL,
  failure_class TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS llm_traces_org_idx ON llm_execution_traces(org_id);
CREATE INDEX IF NOT EXISTS llm_traces_agent_idx ON llm_execution_traces(agent_id);
CREATE INDEX IF NOT EXISTS llm_traces_model_idx ON llm_execution_traces(model);
CREATE INDEX IF NOT EXISTS llm_traces_conversation_idx ON llm_execution_traces(conversation_id);
CREATE INDEX IF NOT EXISTS llm_traces_workflow_run_idx ON llm_execution_traces(workflow_run_id);
CREATE INDEX IF NOT EXISTS llm_traces_created_idx ON llm_execution_traces(created_at);

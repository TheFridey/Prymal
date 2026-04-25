ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cumulative_estimated_cost_gbp REAL NOT NULL DEFAULT 0;

ALTER TABLE execution_usage_event
  ADD COLUMN IF NOT EXISTS estimated_cost_gbp REAL;

ALTER TABLE llm_execution_traces
  ADD COLUMN IF NOT EXISTS estimated_cost_gbp REAL;

CREATE TABLE IF NOT EXISTS workflow_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID REFERENCES organisations(id) ON DELETE CASCADE,
  source_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  description        TEXT,
  parameters         JSONB NOT NULL DEFAULT '{}',
  trigger_type       trigger_type NOT NULL DEFAULT 'manual',
  trigger_config     JSONB NOT NULL DEFAULT '{}',
  nodes              JSONB NOT NULL DEFAULT '[]',
  edges              JSONB NOT NULL DEFAULT '[]',
  is_public          BOOLEAN NOT NULL DEFAULT false,
  share_id           TEXT NOT NULL UNIQUE,
  usage_count        INTEGER NOT NULL DEFAULT 0,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_templates_org_idx ON workflow_templates(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_share_idx ON workflow_templates(share_id);
CREATE INDEX IF NOT EXISTS workflow_templates_public_idx ON workflow_templates(is_public);

CREATE TABLE IF NOT EXISTS content_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  message_id          UUID REFERENCES messages(id) ON DELETE SET NULL,
  conversation_id     UUID REFERENCES conversations(id) ON DELETE SET NULL,
  workflow_id         UUID REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_run_id     UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  source_agent        agent_id NOT NULL,
  content_type        TEXT NOT NULL DEFAULT 'agent_output',
  title               TEXT,
  body                TEXT,
  parent_content_id   UUID REFERENCES content_assets(id) ON DELETE SET NULL,
  derived_content_ids UUID[] NOT NULL DEFAULT '{}',
  delivery_status     TEXT NOT NULL DEFAULT 'draft',
  delivered_at        TIMESTAMPTZ,
  result_metadata     JSONB NOT NULL DEFAULT '{}',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_assets_org_idx ON content_assets(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS content_assets_message_idx ON content_assets(message_id);
CREATE INDEX IF NOT EXISTS content_assets_parent_idx ON content_assets(parent_content_id);
CREATE INDEX IF NOT EXISTS content_assets_workflow_idx ON content_assets(workflow_id);
CREATE INDEX IF NOT EXISTS content_assets_source_idx ON content_assets(source_agent);
CREATE INDEX IF NOT EXISTS content_assets_created_idx ON content_assets(created_at);

CREATE TABLE IF NOT EXISTS lore_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  content_id      UUID REFERENCES content_assets(id) ON DELETE SET NULL,
  outcome_type    TEXT NOT NULL CHECK (outcome_type IN ('success', 'failure', 'partial')),
  outcome_metric  TEXT NOT NULL,
  notes           TEXT,
  source_agent    agent_id,
  workflow_id     UUID REFERENCES workflows(id) ON DELETE SET NULL,
  workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  value           REAL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lore_feedback_org_idx ON lore_feedback(org_id);
CREATE INDEX IF NOT EXISTS lore_feedback_content_idx ON lore_feedback(content_id);
CREATE INDEX IF NOT EXISTS lore_feedback_agent_idx ON lore_feedback(source_agent);
CREATE INDEX IF NOT EXISTS lore_feedback_metric_idx ON lore_feedback(outcome_metric);
CREATE INDEX IF NOT EXISTS lore_feedback_recorded_idx ON lore_feedback(recorded_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'workflow_templates_updated_at') THEN
    CREATE TRIGGER workflow_templates_updated_at BEFORE UPDATE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'content_assets_updated_at') THEN
    CREATE TRIGGER content_assets_updated_at BEFORE UPDATE ON content_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

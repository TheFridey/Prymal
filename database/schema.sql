CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan') THEN
    CREATE TYPE plan AS ENUM ('free', 'solo', 'pro', 'teams', 'agency');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_id') THEN
    CREATE TYPE agent_id AS ENUM (
      'cipher','herald','lore','forge','atlas','echo',
      'pixel','oracle','vance','wren','ledger','nexus','scout','sage','sentinel'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_type') THEN
    CREATE TYPE source_type AS ENUM ('manual','url','text','markdown','csv','pdf','docx','notion','gdrive');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_status') THEN
    CREATE TYPE doc_status AS ENUM ('pending','indexing','indexed','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trigger_type') THEN
    CREATE TYPE trigger_type AS ENUM ('manual','schedule','webhook','event');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
    CREATE TYPE run_status AS ENUM ('queued','running','completed','failed','cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type') THEN
    CREATE TYPE memory_type AS ENUM ('preference','fact','instruction','pattern');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_scope') THEN
    CREATE TYPE memory_scope AS ENUM ('org','user','agent_private','restricted','workflow_run','temporary_session');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
    CREATE TYPE invitation_status AS ENUM ('pending','accepted','revoked','expired');
  END IF;
END $$;

CREATE TABLE organisations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  plan                  plan NOT NULL DEFAULT 'free',
  stripe_customer_id    TEXT,
  stripe_sub_id         TEXT,
  monthly_credit_limit  INTEGER NOT NULL DEFAULT 50,
  seat_limit            INTEGER NOT NULL DEFAULT 1,
  credits_used          INTEGER NOT NULL DEFAULT 0,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  org_id        UUID REFERENCES organisations(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'member',
  first_name    TEXT,
  last_name     TEXT,
  avatar_url    TEXT,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_org_idx ON users(org_id);

CREATE TABLE lore_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  uploaded_by   TEXT REFERENCES users(id),
  title         TEXT NOT NULL,
  source_type   source_type NOT NULL,
  source_url    TEXT,
  raw_content   TEXT,
  word_count    INTEGER,
  status        doc_status NOT NULL DEFAULT 'pending',
  version       INTEGER NOT NULL DEFAULT 1,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX lore_docs_org_idx ON lore_documents(org_id);
CREATE INDEX lore_docs_status_idx ON lore_documents(status);

CREATE TABLE lore_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES lore_documents(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  embedding     vector(1536),
  token_count   INTEGER,
  metadata      JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX chunks_org_idx ON lore_chunks(org_id);
CREATE INDEX chunks_embedding_idx
  ON lore_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  agent_id        agent_id NOT NULL,
  title           TEXT,
  context_summary TEXT,
  message_count   INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX conv_user_agent_idx ON conversations(user_id, agent_id);
CREATE INDEX conv_org_idx ON conversations(org_id);

CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role              message_role NOT NULL,
  content           TEXT NOT NULL,
  lore_chunks_used  UUID[],
  tokens_used       INTEGER,
  processing_ms     INTEGER,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conv_idx ON messages(conversation_id);

CREATE TABLE agent_memory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  agent_id     agent_id NOT NULL,
  scope        memory_scope NOT NULL DEFAULT 'org',
  scope_key    TEXT NOT NULL,
  workflow_run_id UUID,
  session_key  TEXT,
  memory_type  memory_type NOT NULL,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  provenance_kind TEXT NOT NULL DEFAULT 'confirmed',
  source_ref   TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  version      INTEGER NOT NULL DEFAULT 1,
  confidence   REAL NOT NULL DEFAULT 0.5,
  usage_count  INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, agent_id, scope, scope_key, key)
);

CREATE INDEX memory_org_agent_idx ON agent_memory(org_id, agent_id);
CREATE INDEX memory_user_scope_idx ON agent_memory(org_id, user_id, agent_id);
CREATE INDEX memory_workflow_run_idx ON agent_memory(workflow_run_id);
CREATE INDEX memory_expires_idx ON agent_memory(expires_at);

CREATE TABLE organisation_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'member',
  invited_by    TEXT REFERENCES users(id),
  token_hash    TEXT NOT NULL UNIQUE,
  token_preview TEXT NOT NULL,
  status        invitation_status NOT NULL DEFAULT 'pending',
  seat_count    INTEGER NOT NULL DEFAULT 1,
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX org_invites_org_idx ON organisation_invitations(org_id);
CREATE INDEX org_invites_email_idx ON organisation_invitations(email);
CREATE INDEX org_invites_status_idx ON organisation_invitations(status);

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id),
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_org_idx ON audit_logs(org_id);
CREATE INDEX audit_logs_action_idx ON audit_logs(action);

CREATE TABLE admin_action_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id    TEXT REFERENCES users(id),
  actor_staff_role TEXT NOT NULL,
  action           TEXT NOT NULL,
  permission       TEXT NOT NULL,
  target_type      TEXT NOT NULL,
  target_id        TEXT,
  request_id       TEXT,
  idempotency_key  TEXT,
  reason_code      TEXT NOT NULL,
  reason           TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_action_logs_org_idx ON admin_action_logs(org_id);
CREATE INDEX admin_action_logs_action_idx ON admin_action_logs(action);
CREATE INDEX admin_action_logs_staff_role_idx ON admin_action_logs(actor_staff_role);
CREATE INDEX admin_action_logs_created_idx ON admin_action_logs(created_at);
CREATE UNIQUE INDEX admin_action_logs_idempotency_idx ON admin_action_logs(actor_user_id, action, idempotency_key);

CREATE TABLE product_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX product_events_org_idx ON product_events(org_id);
CREATE INDEX product_events_name_idx ON product_events(event_name);

CREATE TABLE credit_adjustments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id         TEXT REFERENCES users(id),
  delta                 INTEGER NOT NULL,
  previous_credits_used INTEGER NOT NULL,
  next_credits_used     INTEGER NOT NULL,
  reason_code           TEXT NOT NULL,
  reason                TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX credit_adjustments_org_idx ON credit_adjustments(org_id);
CREATE INDEX credit_adjustments_actor_idx ON credit_adjustments(actor_user_id);
CREATE INDEX credit_adjustments_created_idx ON credit_adjustments(created_at);

CREATE TABLE organisation_feature_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  flag_key   TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, flag_key)
);

CREATE INDEX org_feature_flags_org_idx ON organisation_feature_flags(org_id);

CREATE TABLE waitlist_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT NOT NULL DEFAULT 'landing',
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX waitlist_entries_created_idx ON waitlist_entries(created_at);

CREATE TABLE IF NOT EXISTS powerups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  prompt     TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS powerups_agent_idx ON powerups(agent_id);

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_unsubscribes_email_idx ON email_unsubscribes(email);

CREATE TABLE integrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  service          TEXT NOT NULL,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes           TEXT[] NOT NULL DEFAULT '{}',
  account_id       TEXT,
  account_email    TEXT,
  meta             JSONB NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, service)
);

CREATE TABLE workflows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by     TEXT REFERENCES users(id),
  name           TEXT NOT NULL,
  description    TEXT,
  trigger_type   trigger_type NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  nodes          JSONB NOT NULL DEFAULT '[]',
  edges          JSONB NOT NULL DEFAULT '[]',
  is_active      BOOLEAN NOT NULL DEFAULT false,
  run_count      INTEGER NOT NULL DEFAULT 0,
  last_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workflows_org_idx ON workflows(org_id);

CREATE TABLE workflow_webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  secret      TEXT NOT NULL,
  events      TEXT[] NOT NULL DEFAULT '{}',
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workflow_webhooks_org_idx ON workflow_webhooks(org_id);
CREATE INDEX workflow_webhooks_workflow_idx ON workflow_webhooks(workflow_id);

CREATE TABLE workflow_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id  UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  triggered_by TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  status       run_status NOT NULL DEFAULT 'queued',
  idempotency_key TEXT,
  execution_mode TEXT NOT NULL DEFAULT 'inline',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  failure_class TEXT,
  node_outputs JSONB NOT NULL DEFAULT '{}',
  run_log JSONB NOT NULL DEFAULT '[]',
  error_log    TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  started_at   TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  replay_of_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX runs_workflow_idx ON workflow_runs(workflow_id);
CREATE INDEX runs_org_idx ON workflow_runs(org_id);
CREATE INDEX runs_idempotency_idx ON workflow_runs(workflow_id, idempotency_key);
CREATE INDEX runs_status_idx ON workflow_runs(status);
CREATE INDEX runs_failure_class_idx ON workflow_runs(failure_class);

ALTER TABLE agent_memory
  ADD CONSTRAINT agent_memory_workflow_run_id_fkey
  FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE SET NULL;

CREATE TABLE llm_execution_traces (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organisations(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
  conversation_id   UUID REFERENCES conversations(id) ON DELETE SET NULL,
  workflow_run_id   UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  agent_id          agent_id NOT NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  policy_key        TEXT NOT NULL,
  route             TEXT NOT NULL,
  route_reason      TEXT,
  fallback_used     BOOLEAN NOT NULL DEFAULT false,
  latency_ms        INTEGER,
  prompt_tokens     INTEGER,
  completion_tokens INTEGER,
  total_tokens      INTEGER,
  estimated_cost_usd REAL,
  tools_used        TEXT[] NOT NULL DEFAULT '{}',
  lore_chunk_ids    UUID[],
  lore_document_ids UUID[],
  memory_read_ids   UUID[],
  memory_write_keys TEXT[] NOT NULL DEFAULT '{}',
  outcome_status    TEXT NOT NULL,
  failure_class     TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX llm_traces_org_idx ON llm_execution_traces(org_id);
CREATE INDEX llm_traces_agent_idx ON llm_execution_traces(agent_id);
CREATE INDEX llm_traces_model_idx ON llm_execution_traces(model);
CREATE INDEX llm_traces_conversation_idx ON llm_execution_traces(conversation_id);
CREATE INDEX llm_traces_workflow_run_idx ON llm_execution_traces(workflow_run_id);
CREATE INDEX llm_traces_created_idx ON llm_execution_traces(created_at);

CREATE TABLE power_ups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         agent_id NOT NULL,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  description      TEXT,
  prompt_template  TEXT NOT NULL,
  input_schema     JSONB NOT NULL DEFAULT '{}',
  is_premium       BOOLEAN NOT NULL DEFAULT false,
  usage_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_by   TEXT REFERENCES users(id),
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  scopes       TEXT[] NOT NULL DEFAULT ARRAY['read','write'],
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX api_keys_org_idx ON api_keys(org_id);

CREATE TABLE email_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email      TEXT NOT NULL,
  template_name TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  send_after    TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_queue_send_after_idx ON email_queue(send_after);
CREATE INDEX email_queue_sent_at_idx ON email_queue(sent_at);

CREATE TABLE referral_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX referral_codes_code_idx ON referral_codes(code);

CREATE TABLE referrals (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  referee_email          TEXT NOT NULL,
  referee_org_id         UUID REFERENCES organisations(id) ON DELETE SET NULL,
  bonus_credits_awarded  INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX referrals_referrer_idx ON referrals(referrer_org_id);
CREATE UNIQUE INDEX referrals_email_unique ON referrals(referrer_org_id, referee_email);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orgs_updated_at ON organisations;
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP TRIGGER IF EXISTS docs_updated_at ON lore_documents;
DROP TRIGGER IF EXISTS memory_updated_at ON agent_memory;
DROP TRIGGER IF EXISTS integ_updated_at ON integrations;
DROP TRIGGER IF EXISTS workflow_updated_at ON workflows;
DROP TRIGGER IF EXISTS workflow_webhooks_updated_at ON workflow_webhooks;
DROP TRIGGER IF EXISTS api_keys_updated_at ON api_keys;
DROP TRIGGER IF EXISTS organisation_invitations_updated_at ON organisation_invitations;

CREATE TRIGGER orgs_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER docs_updated_at BEFORE UPDATE ON lore_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER memory_updated_at BEFORE UPDATE ON agent_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER integ_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workflow_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workflow_webhooks_updated_at BEFORE UPDATE ON workflow_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER organisation_invitations_updated_at BEFORE UPDATE ON organisation_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

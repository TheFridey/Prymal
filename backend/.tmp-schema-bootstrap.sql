CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- vector extension omitted in this local certification bootstrap; production and CI must use pgvector.

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
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_visibility') THEN
    CREATE TYPE workflow_catalogue_visibility AS ENUM ('draft','private','submitted','approved','rejected','published','archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_review_status') THEN
    CREATE TYPE workflow_catalogue_review_status AS ENUM ('not_submitted','pending','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_publisher_type') THEN
    CREATE TYPE workflow_catalogue_publisher_type AS ENUM ('prymal_official','user_creator');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_pricing_type') THEN
    CREATE TYPE workflow_catalogue_pricing_type AS ENUM ('free','premium');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_difficulty') THEN
    CREATE TYPE workflow_catalogue_difficulty AS ENUM ('beginner','intermediate','advanced');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_purchase_status') THEN
    CREATE TYPE workflow_catalogue_purchase_status AS ENUM ('pending','paid','refunded','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type') THEN
    CREATE TYPE memory_type AS ENUM (
      'preference','fact','instruction','pattern',
      'user_preference','business_fact','project_fact','brand_voice','task_state','workflow_state','decision',
      'contact_fact','document_fact','integration_fact','agent_observation','correction','warning','episodic_event','system_note'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_item_status') THEN
    CREATE TYPE memory_item_status AS ENUM (
      'active','pending_review','conflicted','expired','archived','deleted','rejected'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_visibility') THEN
    CREATE TYPE memory_visibility AS ENUM (
      'org_shared','user_private','agent_private_visible','restricted_visible'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_scope') THEN
    CREATE TYPE memory_scope AS ENUM ('org','user','agent_private','restricted','workflow_run','temporary_session');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
    CREATE TYPE invitation_status AS ENUM ('pending','accepted','revoked','expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_event_status') THEN
    CREATE TYPE email_event_status AS ENUM ('pending','sent','skipped','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founding_access_claim_status') THEN
    CREATE TYPE founding_access_claim_status AS ENUM ('claimed','active','cancelled','revoked');
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

CREATE TABLE subscriptions (
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
  cumulative_estimated_cost_gbp  REAL NOT NULL DEFAULT 0,
  cost_guard_state               TEXT NOT NULL DEFAULT 'normal',
  metadata                       JSONB NOT NULL DEFAULT '{}',
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id)
);

CREATE INDEX subscriptions_plan_idx ON subscriptions(plan);
CREATE INDEX subscriptions_period_idx ON subscriptions(current_period_end);

CREATE TABLE offer_configs (
  offer_key       TEXT PRIMARY KEY,
  max_paid_claims INTEGER NOT NULL DEFAULT 25,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX offer_configs_enabled_idx ON offer_configs(is_enabled);

INSERT INTO offer_configs (offer_key, max_paid_claims, is_enabled, metadata)
VALUES (
  'FOUNDING_ACCESS',
  25,
  TRUE,
  '{"headline":"Founding Access is open"}'::jsonb
)
ON CONFLICT (offer_key) DO NOTHING;

CREATE TABLE founding_access_claims (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_key                           TEXT NOT NULL DEFAULT 'FOUNDING_ACCESS' REFERENCES offer_configs(offer_key),
  user_id                             TEXT REFERENCES users(id) ON DELETE SET NULL,
  organisation_id                     UUID REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_customer_id                  TEXT,
  stripe_subscription_id              TEXT,
  plan_id                             plan NOT NULL,
  status                              founding_access_claim_status NOT NULL DEFAULT 'claimed',
  first_month_credit_boost_applied_at TIMESTAMPTZ,
  founder_period_ends_at                 TIMESTAMPTZ,
  claimed_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at                        TIMESTAMPTZ,
  cancelled_at                        TIMESTAMPTZ,
  metadata                            JSONB NOT NULL DEFAULT '{}',
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX founding_access_claims_offer_status_idx ON founding_access_claims(offer_key, status);
CREATE INDEX founding_access_claims_org_idx ON founding_access_claims(organisation_id);
CREATE INDEX founding_access_claims_user_idx ON founding_access_claims(user_id);
CREATE UNIQUE INDEX founding_access_claims_subscription_unique ON founding_access_claims(stripe_subscription_id);
CREATE UNIQUE INDEX founding_access_claims_org_offer_unique ON founding_access_claims(offer_key, organisation_id);

CREATE TABLE founding_access_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'pricing_banner',
  converted_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX founding_access_leads_email_unique ON founding_access_leads(email);
CREATE INDEX founding_access_leads_source_idx ON founding_access_leads(source);
CREATE INDEX founding_access_leads_created_idx ON founding_access_leads(created_at);

CREATE TABLE credit_ledger_execution (
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

CREATE INDEX credit_ledger_execution_org_idx ON credit_ledger_execution(org_id);
CREATE INDEX credit_ledger_execution_subscription_idx ON credit_ledger_execution(subscription_id);
CREATE INDEX credit_ledger_execution_source_idx ON credit_ledger_execution(source);
CREATE INDEX credit_ledger_execution_created_idx ON credit_ledger_execution(created_at);
CREATE INDEX credit_ledger_execution_usage_idx ON credit_ledger_execution(usage_event_id);

CREATE TABLE credit_ledger_video (
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

CREATE INDEX credit_ledger_video_org_idx ON credit_ledger_video(org_id);
CREATE INDEX credit_ledger_video_subscription_idx ON credit_ledger_video(subscription_id);
CREATE INDEX credit_ledger_video_source_idx ON credit_ledger_video(source);
CREATE INDEX credit_ledger_video_created_idx ON credit_ledger_video(created_at);
CREATE INDEX credit_ledger_video_usage_idx ON credit_ledger_video(usage_event_id);

CREATE TABLE execution_usage_event (
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
  estimated_cost_gbp        REAL,
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

CREATE INDEX execution_usage_event_org_idx ON execution_usage_event(org_id);
CREATE INDEX execution_usage_event_status_idx ON execution_usage_event(status);
CREATE INDEX execution_usage_event_created_idx ON execution_usage_event(created_at);
CREATE INDEX execution_usage_event_request_idx ON execution_usage_event(request_id);
CREATE INDEX execution_usage_event_conversation_idx ON execution_usage_event(conversation_id);

CREATE TABLE video_generation_event (
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

CREATE INDEX video_generation_event_org_idx ON video_generation_event(org_id);
CREATE INDEX video_generation_event_status_idx ON video_generation_event(status);
CREATE INDEX video_generation_event_created_idx ON video_generation_event(created_at);
CREATE INDEX video_generation_event_provider_job_idx ON video_generation_event(provider_job_id);
CREATE INDEX video_generation_event_conversation_idx ON video_generation_event(conversation_id);

CREATE TABLE credit_purchase (
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

CREATE INDEX credit_purchase_org_idx ON credit_purchase(org_id);
CREATE INDEX credit_purchase_type_idx ON credit_purchase(credit_type);
CREATE INDEX credit_purchase_status_idx ON credit_purchase(status);

CREATE TABLE usage_estimate_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  subscription_id     UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_key            TEXT NOT NULL,
  action_type         TEXT NOT NULL,
  cost_class          TEXT NOT NULL,
  estimated_gbp_cost  DOUBLE PRECISION NOT NULL DEFAULT 0,
  credit_cost         INTEGER NOT NULL DEFAULT 0,
  provider            TEXT,
  model               TEXT,
  reference_kind      TEXT,
  reference_id        UUID,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX usage_estimate_events_org_created_idx ON usage_estimate_events(organisation_id, created_at DESC);
CREATE INDEX usage_estimate_events_created_idx ON usage_estimate_events(created_at DESC);
CREATE INDEX usage_estimate_events_user_created_idx ON usage_estimate_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE TABLE threshold_state (
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

CREATE INDEX threshold_state_org_idx ON threshold_state(org_id);
CREATE INDEX threshold_state_cycle_idx ON threshold_state(credit_type, cycle_key);

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
  embedding JSONB,
  token_count   INTEGER,
  metadata      JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX chunks_org_idx ON lore_chunks(org_id);
-- vector index omitted in this local certification bootstrap.

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

CREATE TABLE memory_contradiction_groups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  resolved_at       TIMESTAMPTZ,
  winning_memory_id UUID,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX memory_contradiction_groups_org_idx ON memory_contradiction_groups(org_id);

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
  title        TEXT,
  content      TEXT,
  summary      TEXT,
  provenance_kind TEXT NOT NULL DEFAULT 'confirmed',
  source_ref   TEXT,
  memory_source_kind TEXT NOT NULL DEFAULT 'conversation',
  source_agent agent_id,
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  source_document_id UUID REFERENCES lore_documents(id) ON DELETE SET NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  version      INTEGER NOT NULL DEFAULT 1,
  confidence   REAL NOT NULL DEFAULT 0.5,
  importance_score REAL NOT NULL DEFAULT 0.5,
  authority_score REAL NOT NULL DEFAULT 0.5,
  freshness_score REAL NOT NULL DEFAULT 0.5,
  usage_count  INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  promoted_at  TIMESTAMPTZ,
  archived_at  TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  memory_item_status memory_item_status NOT NULL DEFAULT 'active',
  visibility memory_visibility NOT NULL DEFAULT 'org_shared',
  contradiction_group_id UUID REFERENCES memory_contradiction_groups(id) ON DELETE SET NULL,
  parent_memory_id UUID,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  always_include BOOLEAN NOT NULL DEFAULT FALSE,
  never_forget BOOLEAN NOT NULL DEFAULT FALSE,
  user_locked BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_updated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, agent_id, scope, scope_key, key)
);

ALTER TABLE memory_contradiction_groups
  ADD CONSTRAINT memory_contradiction_groups_winning_fkey
  FOREIGN KEY (winning_memory_id) REFERENCES agent_memory(id) ON DELETE SET NULL;

ALTER TABLE agent_memory
  ADD CONSTRAINT agent_memory_parent_memory_id_fkey
  FOREIGN KEY (parent_memory_id) REFERENCES agent_memory(id) ON DELETE SET NULL;

CREATE INDEX memory_org_agent_idx ON agent_memory(org_id, agent_id);
CREATE INDEX memory_user_scope_idx ON agent_memory(org_id, user_id, agent_id);
CREATE INDEX memory_workflow_run_idx ON agent_memory(workflow_run_id);
CREATE INDEX memory_expires_idx ON agent_memory(expires_at);
CREATE INDEX memory_org_status_idx ON agent_memory(org_id, memory_item_status);
CREATE INDEX memory_contradiction_group_idx ON agent_memory(contradiction_group_id);
CREATE INDEX memory_pinned_idx ON agent_memory(org_id, pinned);

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

CREATE TABLE warden_audit_event (
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

CREATE INDEX warden_audit_org_idx ON warden_audit_event(org_id, created_at);
CREATE INDEX warden_audit_surface_idx ON warden_audit_event(surface);
CREATE INDEX warden_audit_verdict_idx ON warden_audit_event(verdict);
CREATE INDEX warden_audit_risk_idx ON warden_audit_event(risk_level);
CREATE INDEX warden_audit_tool_idx ON warden_audit_event(tool_name);

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

CREATE TABLE email_events (
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

CREATE INDEX email_events_org_idx ON email_events(org_id, created_at);
CREATE INDEX email_events_user_idx ON email_events(user_id);
CREATE INDEX email_events_type_idx ON email_events(email_type);
CREATE INDEX email_events_status_idx ON email_events(status);
CREATE UNIQUE INDEX email_events_idempotency_unique ON email_events(idempotency_key);

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
  contract_enforced BOOLEAN NOT NULL DEFAULT false,
  contract_enforced_at TIMESTAMPTZ,
  run_count      INTEGER NOT NULL DEFAULT 0,
  last_run_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workflows_org_idx ON workflows(org_id);
CREATE INDEX workflows_contract_enforced_idx ON workflows(contract_enforced);

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

CREATE TABLE workflow_risk_confirmation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  workflow_run_id UUID,
  warden_audit_id UUID,
  risk_summary    JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending',
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at         TIMESTAMPTZ
);

CREATE INDEX workflow_risk_confirmation_org_idx ON workflow_risk_confirmation(org_id);
CREATE INDEX workflow_risk_confirmation_workflow_idx ON workflow_risk_confirmation(workflow_id);
CREATE INDEX workflow_risk_confirmation_status_idx ON workflow_risk_confirmation(status);
CREATE INDEX workflow_risk_confirmation_expires_idx ON workflow_risk_confirmation(expires_at);

CREATE TABLE workflow_templates (
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

CREATE INDEX workflow_templates_org_idx ON workflow_templates(org_id);
CREATE UNIQUE INDEX workflow_templates_share_idx ON workflow_templates(share_id);
CREATE INDEX workflow_templates_public_idx ON workflow_templates(is_public);

CREATE TABLE workflow_catalogue_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                        TEXT NOT NULL UNIQUE,
  title                       TEXT NOT NULL,
  short_description           TEXT NOT NULL,
  long_description            TEXT,
  category                    TEXT NOT NULL,
  tags                        JSONB NOT NULL DEFAULT '[]',
  visibility                  workflow_catalogue_visibility NOT NULL DEFAULT 'draft',
  source_workflow_id          UUID REFERENCES workflows(id) ON DELETE SET NULL,
  template_workflow_definition JSONB NOT NULL,
  creator_user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  creator_org_id              UUID REFERENCES organisations(id) ON DELETE SET NULL,
  creator_display_name        TEXT,
  publisher_type              workflow_catalogue_publisher_type NOT NULL DEFAULT 'user_creator',
  pricing_type                workflow_catalogue_pricing_type NOT NULL DEFAULT 'free',
  price_gbp_pence             INTEGER,
  stripe_price_id             TEXT,
  revenue_share_bps           INTEGER,
  status_note                 TEXT,
  review_status               workflow_catalogue_review_status NOT NULL DEFAULT 'not_submitted',
  reviewed_by_user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at                 TIMESTAMPTZ,
  rejection_reason            TEXT,
  install_count               INTEGER NOT NULL DEFAULT 0,
  run_count                   INTEGER NOT NULL DEFAULT 0,
  rating_average              REAL,
  rating_count                INTEGER NOT NULL DEFAULT 0,
  estimated_execution_credits INTEGER,
  estimated_video_credits     INTEGER,
  estimated_cost_gbp          REAL,
  difficulty                  workflow_catalogue_difficulty NOT NULL DEFAULT 'beginner',
  expected_runtime_label      TEXT,
  required_plan               plan,
  expected_output             JSONB NOT NULL DEFAULT '[]',
  required_inputs             JSONB NOT NULL DEFAULT '[]',
  validation_warnings         JSONB NOT NULL DEFAULT '[]',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at                TIMESTAMPTZ,
  archived_at                 TIMESTAMPTZ
);

CREATE UNIQUE INDEX workflow_catalogue_items_slug_idx ON workflow_catalogue_items(slug);
CREATE INDEX workflow_catalogue_items_visibility_idx ON workflow_catalogue_items(visibility);
CREATE INDEX workflow_catalogue_items_review_idx ON workflow_catalogue_items(review_status);
CREATE INDEX workflow_catalogue_items_creator_org_idx ON workflow_catalogue_items(creator_org_id);
CREATE INDEX workflow_catalogue_items_category_idx ON workflow_catalogue_items(category);

CREATE TABLE workflow_catalogue_installs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id     UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  installed_workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_version        INTEGER,
  customised            BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX workflow_catalogue_installs_item_idx ON workflow_catalogue_installs(catalogue_item_id);
CREATE INDEX workflow_catalogue_installs_org_idx ON workflow_catalogue_installs(org_id);
CREATE UNIQUE INDEX workflow_catalogue_installs_workflow_idx ON workflow_catalogue_installs(installed_workflow_id);

CREATE TABLE workflow_catalogue_reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id            UUID REFERENCES organisations(id) ON DELETE SET NULL,
  rating            INTEGER NOT NULL,
  review_text       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workflow_catalogue_reviews_item_idx ON workflow_catalogue_reviews(catalogue_item_id);
CREATE UNIQUE INDEX workflow_catalogue_reviews_user_item_idx ON workflow_catalogue_reviews(catalogue_item_id, user_id);

CREATE TABLE workflow_catalogue_purchases (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id          UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  buyer_user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_org_id               UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  seller_user_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  seller_org_id              UUID REFERENCES organisations(id) ON DELETE SET NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,
  amount_gbp_pence           INTEGER NOT NULL,
  platform_fee_gbp_pence     INTEGER NOT NULL,
  creator_payout_gbp_pence   INTEGER NOT NULL,
  status                     workflow_catalogue_purchase_status NOT NULL DEFAULT 'pending',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workflow_catalogue_purchases_item_idx ON workflow_catalogue_purchases(catalogue_item_id);
CREATE INDEX workflow_catalogue_purchases_buyer_org_idx ON workflow_catalogue_purchases(buyer_org_id);
CREATE UNIQUE INDEX workflow_catalogue_purchases_session_idx ON workflow_catalogue_purchases(stripe_checkout_session_id);

CREATE TABLE workflow_catalogue_versions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id  UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  version_number     INTEGER NOT NULL,
  workflow_definition JSONB NOT NULL,
  changelog          TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX workflow_catalogue_versions_item_version_idx ON workflow_catalogue_versions(catalogue_item_id, version_number);

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

CREATE TABLE memory_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  agent_id         agent_id,
  workflow_run_id  UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  importance_score REAL NOT NULL DEFAULT 0.5,
  source_type      TEXT NOT NULL DEFAULT 'system',
  source_ref       TEXT,
  daily_bucket     DATE NOT NULL DEFAULT (timezone('UTC', now()))::date,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX memory_events_org_created_idx ON memory_events(org_id, created_at DESC);
CREATE INDEX memory_events_org_daily_idx ON memory_events(org_id, daily_bucket DESC);

CREATE TABLE memory_promotion_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  candidate_memory_id UUID REFERENCES agent_memory(id) ON DELETE SET NULL,
  should_promote   BOOLEAN NOT NULL,
  target_scope     TEXT,
  target_type      TEXT,
  confidence_score REAL,
  importance_score REAL,
  reason           TEXT,
  review_required  BOOLEAN NOT NULL DEFAULT FALSE,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX memory_promotion_events_org_idx ON memory_promotion_events(org_id, created_at DESC);

CREATE TABLE memory_retrieval_traces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  agent_id         agent_id,
  workflow_run_id  UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
  conversation_id  UUID,
  policy_snapshot  JSONB NOT NULL DEFAULT '{}',
  selected_ids     UUID[] NOT NULL DEFAULT '{}',
  retrieval_items  JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX memory_retrieval_traces_org_idx ON memory_retrieval_traces(org_id, created_at DESC);

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
  estimated_cost_gbp REAL,
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

CREATE TABLE agent_eval_summaries (
  agent_id                    TEXT NOT NULL,
  policy_class                TEXT NOT NULL,
  org_id                      TEXT NOT NULL,
  avg_groundedness            REAL,
  avg_citation_score          REAL,
  avg_structured_output_score REAL,
  avg_tool_policy_score       REAL,
  avg_hallucination_risk      REAL,
  hold_count                  INTEGER NOT NULL DEFAULT 0,
  repair_count                INTEGER NOT NULL DEFAULT 0,
  pass_count                  INTEGER NOT NULL DEFAULT 0,
  sample_size                 INTEGER NOT NULL DEFAULT 0,
  last_updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, policy_class, org_id)
);

CREATE INDEX agent_eval_summaries_org_idx ON agent_eval_summaries(org_id);

CREATE TABLE kg_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  properties  JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX kg_entities_org_idx ON kg_entities(org_id);
CREATE INDEX kg_entities_type_idx ON kg_entities(org_id, type);

CREATE TABLE kg_relationships (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         TEXT NOT NULL,
  from_entity_id UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  to_entity_id   UUID NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  properties     JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX kg_relationships_org_idx ON kg_relationships(org_id);
CREATE INDEX kg_relationships_from_idx ON kg_relationships(from_entity_id);
CREATE INDEX kg_relationships_to_idx ON kg_relationships(to_entity_id);

CREATE TABLE kg_entity_embeddings (
  entity_id UUID PRIMARY KEY REFERENCES kg_entities(id) ON DELETE CASCADE,
  embedding JSONB
);

CREATE TABLE lore_quality_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL,
  org_id      TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  verdict     TEXT NOT NULL,
  eval_scores JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX lore_quality_signals_doc_idx ON lore_quality_signals(document_id, org_id);
CREATE INDEX lore_quality_signals_org_idx ON lore_quality_signals(org_id);

CREATE TABLE action_approvals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  verdict     TEXT,
  workflow_id TEXT,
  node_id     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_action_approvals_token ON action_approvals(token_hash);
CREATE INDEX idx_action_approvals_org ON action_approvals(org_id, created_at DESC);

CREATE TABLE content_assets (
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

CREATE INDEX content_assets_org_idx ON content_assets(org_id);
CREATE UNIQUE INDEX content_assets_message_idx ON content_assets(message_id);
CREATE INDEX content_assets_parent_idx ON content_assets(parent_content_id);
CREATE INDEX content_assets_workflow_idx ON content_assets(workflow_id);
CREATE INDEX content_assets_source_idx ON content_assets(source_agent);
CREATE INDEX content_assets_created_idx ON content_assets(created_at);

CREATE TABLE lore_feedback (
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

CREATE INDEX lore_feedback_org_idx ON lore_feedback(org_id);
CREATE INDEX lore_feedback_content_idx ON lore_feedback(content_id);
CREATE INDEX lore_feedback_agent_idx ON lore_feedback(source_agent);
CREATE INDEX lore_feedback_metric_idx ON lore_feedback(outcome_metric);
CREATE INDEX lore_feedback_recorded_idx ON lore_feedback(recorded_at);

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
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
DROP TRIGGER IF EXISTS execution_usage_event_updated_at ON execution_usage_event;
DROP TRIGGER IF EXISTS video_generation_event_updated_at ON video_generation_event;
DROP TRIGGER IF EXISTS credit_purchase_updated_at ON credit_purchase;
DROP TRIGGER IF EXISTS threshold_state_updated_at ON threshold_state;
DROP TRIGGER IF EXISTS offer_configs_updated_at ON offer_configs;
DROP TRIGGER IF EXISTS founding_access_claims_updated_at ON founding_access_claims;

CREATE TRIGGER orgs_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER docs_updated_at BEFORE UPDATE ON lore_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER memory_updated_at BEFORE UPDATE ON agent_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER integ_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workflow_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workflow_webhooks_updated_at BEFORE UPDATE ON workflow_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER workflow_templates_updated_at BEFORE UPDATE ON workflow_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER content_assets_updated_at BEFORE UPDATE ON content_assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER organisation_invitations_updated_at BEFORE UPDATE ON organisation_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER execution_usage_event_updated_at BEFORE UPDATE ON execution_usage_event FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER video_generation_event_updated_at BEFORE UPDATE ON video_generation_event FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER credit_purchase_updated_at BEFORE UPDATE ON credit_purchase FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER threshold_state_updated_at BEFORE UPDATE ON threshold_state FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER offer_configs_updated_at BEFORE UPDATE ON offer_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER founding_access_claims_updated_at BEFORE UPDATE ON founding_access_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Prymal structured memory architecture: extends agent_memory + episodic timeline + contradiction groups.
-- Apply after prior migrations. Safe to re-run fragments manually if a statement fails mid-flight.

-- ---------------------------------------------------------------------------
-- New ENUM types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE memory_item_status AS ENUM (
    'active', 'pending_review', 'conflicted', 'expired', 'archived', 'deleted', 'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE memory_visibility AS ENUM (
    'org_shared', 'user_private', 'agent_private_visible', 'restricted_visible'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Extend memory_type (legacy values preserved)
-- ---------------------------------------------------------------------------
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'user_preference'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'business_fact'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'project_fact'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'brand_voice'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'task_state'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'workflow_state'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'decision'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'contact_fact'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'document_fact'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'integration_fact'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'agent_observation'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'correction'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'warning'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'episodic_event'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE memory_type ADD VALUE 'system_note'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Contradiction groups (created before FK from agent_memory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memory_contradiction_groups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  resolved_at       TIMESTAMPTZ,
  winning_memory_id UUID,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memory_contradiction_groups_org_idx ON memory_contradiction_groups(org_id);

-- ---------------------------------------------------------------------------
-- agent_memory extensions
-- ---------------------------------------------------------------------------
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS importance_score REAL NOT NULL DEFAULT 0.5;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS authority_score REAL NOT NULL DEFAULT 0.5;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS freshness_score REAL NOT NULL DEFAULT 0.5;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS memory_source_kind TEXT NOT NULL DEFAULT 'conversation';
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS source_agent agent_id;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES lore_documents(id) ON DELETE SET NULL;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS memory_item_status memory_item_status NOT NULL DEFAULT 'active';
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS visibility memory_visibility NOT NULL DEFAULT 'org_shared';
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS contradiction_group_id UUID REFERENCES memory_contradiction_groups(id) ON DELETE SET NULL;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS parent_memory_id UUID;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE agent_memory SET content = value WHERE content IS NULL;
UPDATE agent_memory SET title = COALESCE(title, key) WHERE title IS NULL;

ALTER TABLE memory_contradiction_groups
  ADD CONSTRAINT memory_contradiction_groups_winning_fkey
  FOREIGN KEY (winning_memory_id) REFERENCES agent_memory(id) ON DELETE SET NULL;

ALTER TABLE agent_memory
  ADD CONSTRAINT agent_memory_parent_memory_id_fkey
  FOREIGN KEY (parent_memory_id) REFERENCES agent_memory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS memory_org_status_idx ON agent_memory(org_id, memory_item_status);
CREATE INDEX IF NOT EXISTS memory_contradiction_group_idx ON agent_memory(contradiction_group_id);
CREATE INDEX IF NOT EXISTS memory_pinned_idx ON agent_memory(org_id, pinned);

-- ---------------------------------------------------------------------------
-- Episodic timeline + audit satellites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memory_events (
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

CREATE INDEX IF NOT EXISTS memory_events_org_created_idx ON memory_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memory_events_org_daily_idx ON memory_events(org_id, daily_bucket DESC);

CREATE TABLE IF NOT EXISTS memory_promotion_events (
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

CREATE INDEX IF NOT EXISTS memory_promotion_events_org_idx ON memory_promotion_events(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_retrieval_traces (
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

CREATE INDEX IF NOT EXISTS memory_retrieval_traces_org_idx ON memory_retrieval_traces(org_id, created_at DESC);

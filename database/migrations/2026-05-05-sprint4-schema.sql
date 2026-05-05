-- Sprint 4 schema migrations
-- REQUIRES MIGRATION before deploying P4 (contract_enforced), P5 (agent_eval_summaries),
-- P11 (knowledge graph), P12 (lore quality signals)

-- ──────────────────────────────────────────────────────────────────────────────
-- P4: Contract enforcement flag on workflows
-- New workflows created after this migration default to contract_enforced = false.
-- The application sets it to true for all newly created workflows going forward.
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS contract_enforced BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS workflows_contract_enforced_idx
  ON workflows (contract_enforced);

-- ──────────────────────────────────────────────────────────────────────────────
-- P5: Agent eval summaries (exponential moving average of eval scores per agent+policy+org)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_eval_summaries (
  agent_id          TEXT    NOT NULL,
  policy_class      TEXT    NOT NULL,
  org_id            TEXT    NOT NULL,
  avg_groundedness  FLOAT,
  avg_citation_score       FLOAT,
  avg_structured_output_score FLOAT,
  avg_tool_policy_score    FLOAT,
  avg_hallucination_risk   FLOAT,
  hold_count        INTEGER NOT NULL DEFAULT 0,
  repair_count      INTEGER NOT NULL DEFAULT 0,
  pass_count        INTEGER NOT NULL DEFAULT 0,
  sample_size       INTEGER NOT NULL DEFAULT 0,
  last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (agent_id, policy_class, org_id)
);

-- ──────────────────────────────────────────────────────────────────────────────
-- P11: Knowledge graph — entities, relationships, embeddings
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kg_entities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT        NOT NULL,
  type        TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  properties  JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kg_entities_org_idx ON kg_entities (org_id);
CREATE INDEX IF NOT EXISTS kg_entities_type_idx ON kg_entities (org_id, type);

CREATE TABLE IF NOT EXISTS kg_relationships (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         TEXT        NOT NULL,
  from_entity_id UUID        NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  to_entity_id   UUID        NOT NULL REFERENCES kg_entities(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL,
  properties     JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kg_relationships_org_idx  ON kg_relationships (org_id);
CREATE INDEX IF NOT EXISTS kg_relationships_from_idx ON kg_relationships (from_entity_id);
CREATE INDEX IF NOT EXISTS kg_relationships_to_idx   ON kg_relationships (to_entity_id);

CREATE TABLE IF NOT EXISTS kg_entity_embeddings (
  entity_id   UUID        PRIMARY KEY REFERENCES kg_entities(id) ON DELETE CASCADE,
  embedding   VECTOR(1536)
);

-- ──────────────────────────────────────────────────────────────────────────────
-- P12: LORE quality signals from SENTINEL verdicts
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lore_quality_signals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT        NOT NULL,
  org_id      TEXT        NOT NULL,
  agent_id    TEXT        NOT NULL,
  verdict     TEXT        NOT NULL, -- 'pass' | 'repair' | 'hold'
  eval_scores JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lore_quality_signals_doc_idx ON lore_quality_signals (document_id, org_id);
CREATE INDEX IF NOT EXISTS lore_quality_signals_org_idx ON lore_quality_signals (org_id);

-- Migration: P5 agent eval summaries
-- Table already created in 2026-05-05-sprint4-schema.sql.
-- This file is a no-op guard for environments that run migrations in order.

CREATE TABLE IF NOT EXISTS agent_eval_summaries (
  agent_id                    TEXT NOT NULL,
  policy_class                TEXT NOT NULL,
  org_id                      TEXT NOT NULL,
  avg_groundedness            FLOAT DEFAULT 0.0,
  avg_citation_score          FLOAT DEFAULT 0.0,
  avg_structured_output_score FLOAT DEFAULT 0.0,
  avg_tool_policy_score       FLOAT DEFAULT 0.0,
  avg_hallucination_risk      FLOAT DEFAULT 0.0,
  hold_count                  INTEGER DEFAULT 0,
  repair_count                INTEGER DEFAULT 0,
  pass_count                  INTEGER DEFAULT 0,
  sample_size                 INTEGER DEFAULT 0,
  last_updated_at             TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (agent_id, policy_class, org_id)
);

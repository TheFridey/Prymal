DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_scope') THEN
    ALTER TYPE memory_scope ADD VALUE IF NOT EXISTS 'agent_private';
    ALTER TYPE memory_scope ADD VALUE IF NOT EXISTS 'restricted';
    ALTER TYPE memory_scope ADD VALUE IF NOT EXISTS 'workflow_run';
    ALTER TYPE memory_scope ADD VALUE IF NOT EXISTS 'temporary_session';
  END IF;
END $$;

ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS scope_key TEXT,
  ADD COLUMN IF NOT EXISTS workflow_run_id UUID,
  ADD COLUMN IF NOT EXISTS session_key TEXT,
  ADD COLUMN IF NOT EXISTS provenance_kind TEXT,
  ADD COLUMN IF NOT EXISTS source_ref TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE agent_memory
SET scope_key = CASE
  WHEN scope = 'user' AND user_id IS NOT NULL THEN 'user:' || user_id
  ELSE 'org:' || org_id::text
END
WHERE scope_key IS NULL;

UPDATE agent_memory
SET provenance_kind = CASE
  WHEN confidence >= 0.95 THEN 'confirmed'
  ELSE 'inferred'
END
WHERE provenance_kind IS NULL;

UPDATE agent_memory
SET confirmed_at = COALESCE(confirmed_at, updated_at, created_at, NOW())
WHERE provenance_kind = 'confirmed'
  AND confirmed_at IS NULL;

ALTER TABLE agent_memory
  ALTER COLUMN scope_key SET NOT NULL,
  ALTER COLUMN provenance_kind SET DEFAULT 'confirmed',
  ALTER COLUMN provenance_kind SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE agent_memory
    ADD CONSTRAINT agent_memory_workflow_run_id_fkey
    FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS memory_unique_key;
CREATE UNIQUE INDEX IF NOT EXISTS memory_unique_key
  ON agent_memory(org_id, agent_id, scope, scope_key, key);

CREATE INDEX IF NOT EXISTS memory_workflow_run_idx ON agent_memory(workflow_run_id);
CREATE INDEX IF NOT EXISTS memory_expires_idx ON agent_memory(expires_at);

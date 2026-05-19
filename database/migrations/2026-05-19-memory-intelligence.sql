ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS superseded_by UUID;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS contradiction_detected BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'agent_memory_superseded_by_fkey'
      AND table_name = 'agent_memory'
  ) THEN
    ALTER TABLE agent_memory
      ADD CONSTRAINT agent_memory_superseded_by_fkey
      FOREIGN KEY (superseded_by) REFERENCES agent_memory(id) ON DELETE SET NULL;
  END IF;
END $$;

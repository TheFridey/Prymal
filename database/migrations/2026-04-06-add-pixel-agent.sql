DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_id') THEN
    ALTER TYPE agent_id ADD VALUE IF NOT EXISTS 'pixel';
  END IF;
END $$;

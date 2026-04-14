DO $$
BEGIN
  ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'pdf';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'docx';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS run_log jsonb NOT NULL DEFAULT '[]'::jsonb;

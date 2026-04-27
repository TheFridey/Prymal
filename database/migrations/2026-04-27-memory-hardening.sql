-- Mirror of backend/drizzle/0005_memory_hardening.sql for repo-wide schema drift checks
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS always_include BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS never_forget BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS user_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS confidence_updated_at TIMESTAMPTZ;

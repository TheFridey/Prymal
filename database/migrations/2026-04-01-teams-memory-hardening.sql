DO $$
BEGIN
  ALTER TYPE plan ADD VALUE IF NOT EXISTS 'teams';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE memory_scope AS ENUM ('org', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS seat_limit integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE organisations
SET seat_limit = CASE plan::text
  WHEN 'agency' THEN 25
  WHEN 'teams' THEN 5
  ELSE 1
END
WHERE seat_limit = 1;

ALTER TABLE agent_memory
  ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope memory_scope NOT NULL DEFAULT 'org',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE agent_memory DROP CONSTRAINT IF EXISTS agent_memory_org_id_agent_id_key_key;

CREATE INDEX IF NOT EXISTS memory_user_scope_idx ON agent_memory (org_id, user_id, agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS memory_unique_key ON agent_memory (org_id, agent_id, scope, user_id, key);

CREATE TABLE IF NOT EXISTS organisation_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  invited_by text REFERENCES users(id),
  token_hash text NOT NULL UNIQUE,
  token_preview text NOT NULL,
  status invitation_status NOT NULL DEFAULT 'pending',
  seat_count integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_invites_org_idx ON organisation_invitations (org_id);
CREATE INDEX IF NOT EXISTS org_invites_email_idx ON organisation_invitations (email);
CREATE INDEX IF NOT EXISTS org_invites_status_idx ON organisation_invitations (status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON audit_logs (org_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);

CREATE TABLE IF NOT EXISTS product_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_org_idx ON product_events (org_id);
CREATE INDEX IF NOT EXISTS product_events_name_idx ON product_events (event_name);

DO $$
BEGIN
  CREATE TRIGGER org_invitations_updated_at
  BEFORE UPDATE ON organisation_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

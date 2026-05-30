-- Add token expiry timestamp to integrations.
-- Column already exists in schema.js and schema.sql; this migration
-- ensures it is present in any environment where it was not yet applied.
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

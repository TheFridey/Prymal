-- Migration: founding period end timestamps for Founding Access claims
-- Aligns DB with backend/src/db/schema.js (`founding_access_claims.founder_period_ends_at`).

ALTER TABLE founding_access_claims
  ADD COLUMN IF NOT EXISTS founder_period_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN founding_access_claims.founder_period_ends_at IS 'When discounted founding-price window ends (UI + reconciliation).';

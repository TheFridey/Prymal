-- Migration: P4 workflow contract enforcement timestamp
-- contract_enforced column already added in 2026-05-05-sprint4-schema.sql.
-- This migration adds the timestamp column only.
-- Must run before deploying P4.

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS contract_enforced_at TIMESTAMPTZ;

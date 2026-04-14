-- Migration: 2026-04-07-waitlist-invited-at
-- Adds invited_at to waitlist_entries for tracking batch invite dispatch.

ALTER TABLE waitlist_entries
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

CREATE INDEX IF NOT EXISTS waitlist_entries_invited_idx
  ON waitlist_entries (invited_at)
  WHERE invited_at IS NOT NULL;

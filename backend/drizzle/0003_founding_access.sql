-- Migration: 2026-04-26-founding-access
-- Database-backed Founding Access offer state, claims, and lead capture.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'founding_access_claim_status') THEN
    CREATE TYPE founding_access_claim_status AS ENUM ('claimed','active','cancelled','revoked');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS offer_configs (
  offer_key       TEXT PRIMARY KEY,
  max_paid_claims INTEGER NOT NULL DEFAULT 25,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS offer_configs_enabled_idx ON offer_configs(is_enabled);

INSERT INTO offer_configs (offer_key, max_paid_claims, is_enabled, metadata)
VALUES (
  'FOUNDING_ACCESS',
  25,
  TRUE,
  '{"headline":"Founding Access is open"}'::jsonb
)
ON CONFLICT (offer_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS founding_access_claims (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_key                           TEXT NOT NULL DEFAULT 'FOUNDING_ACCESS' REFERENCES offer_configs(offer_key),
  user_id                             TEXT REFERENCES users(id) ON DELETE SET NULL,
  organisation_id                     UUID REFERENCES organisations(id) ON DELETE CASCADE,
  stripe_customer_id                  TEXT,
  stripe_subscription_id              TEXT,
  plan_id                             plan NOT NULL,
  status                              founding_access_claim_status NOT NULL DEFAULT 'claimed',
  first_month_credit_boost_applied_at TIMESTAMPTZ,
  claimed_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at                        TIMESTAMPTZ,
  cancelled_at                        TIMESTAMPTZ,
  metadata                            JSONB NOT NULL DEFAULT '{}',
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS founding_access_claims_offer_status_idx ON founding_access_claims(offer_key, status);
CREATE INDEX IF NOT EXISTS founding_access_claims_org_idx ON founding_access_claims(organisation_id);
CREATE INDEX IF NOT EXISTS founding_access_claims_user_idx ON founding_access_claims(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS founding_access_claims_subscription_unique ON founding_access_claims(stripe_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS founding_access_claims_org_offer_unique ON founding_access_claims(offer_key, organisation_id);

CREATE TABLE IF NOT EXISTS founding_access_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL,
  source            TEXT NOT NULL DEFAULT 'pricing_banner',
  converted_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS founding_access_leads_email_unique ON founding_access_leads(email);
CREATE INDEX IF NOT EXISTS founding_access_leads_source_idx ON founding_access_leads(source);
CREATE INDEX IF NOT EXISTS founding_access_leads_created_idx ON founding_access_leads(created_at);

DO $$
BEGIN
  IF to_regclass('public.offer_configs') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'offer_configs_updated_at' AND tgrelid = 'public.offer_configs'::regclass) THEN
    CREATE TRIGGER offer_configs_updated_at BEFORE UPDATE ON offer_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF to_regclass('public.founding_access_claims') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'founding_access_claims_updated_at' AND tgrelid = 'public.founding_access_claims'::regclass) THEN
    CREATE TRIGGER founding_access_claims_updated_at BEFORE UPDATE ON founding_access_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

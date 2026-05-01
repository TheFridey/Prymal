DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_visibility') THEN
    CREATE TYPE workflow_catalogue_visibility AS ENUM ('draft','private','submitted','approved','rejected','published','archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_review_status') THEN
    CREATE TYPE workflow_catalogue_review_status AS ENUM ('not_submitted','pending','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_publisher_type') THEN
    CREATE TYPE workflow_catalogue_publisher_type AS ENUM ('prymal_official','user_creator');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_pricing_type') THEN
    CREATE TYPE workflow_catalogue_pricing_type AS ENUM ('free','premium');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_difficulty') THEN
    CREATE TYPE workflow_catalogue_difficulty AS ENUM ('beginner','intermediate','advanced');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workflow_catalogue_purchase_status') THEN
    CREATE TYPE workflow_catalogue_purchase_status AS ENUM ('pending','paid','refunded','failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workflow_catalogue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  long_description TEXT,
  category TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  visibility workflow_catalogue_visibility NOT NULL DEFAULT 'draft',
  source_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  template_workflow_definition JSONB NOT NULL,
  creator_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  creator_org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  creator_display_name TEXT,
  publisher_type workflow_catalogue_publisher_type NOT NULL DEFAULT 'user_creator',
  pricing_type workflow_catalogue_pricing_type NOT NULL DEFAULT 'free',
  price_gbp_pence INTEGER,
  stripe_price_id TEXT,
  revenue_share_bps INTEGER,
  status_note TEXT,
  review_status workflow_catalogue_review_status NOT NULL DEFAULT 'not_submitted',
  reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  install_count INTEGER NOT NULL DEFAULT 0,
  run_count INTEGER NOT NULL DEFAULT 0,
  rating_average REAL,
  rating_count INTEGER NOT NULL DEFAULT 0,
  estimated_execution_credits INTEGER,
  estimated_video_credits INTEGER,
  estimated_cost_gbp REAL,
  difficulty workflow_catalogue_difficulty NOT NULL DEFAULT 'beginner',
  expected_runtime_label TEXT,
  required_plan plan,
  expected_output JSONB NOT NULL DEFAULT '[]',
  required_inputs JSONB NOT NULL DEFAULT '[]',
  validation_warnings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_catalogue_items_slug_idx ON workflow_catalogue_items(slug);
CREATE INDEX IF NOT EXISTS workflow_catalogue_items_visibility_idx ON workflow_catalogue_items(visibility);
CREATE INDEX IF NOT EXISTS workflow_catalogue_items_review_idx ON workflow_catalogue_items(review_status);
CREATE INDEX IF NOT EXISTS workflow_catalogue_items_creator_org_idx ON workflow_catalogue_items(creator_org_id);
CREATE INDEX IF NOT EXISTS workflow_catalogue_items_category_idx ON workflow_catalogue_items(category);

CREATE TABLE IF NOT EXISTS workflow_catalogue_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  installed_workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_version INTEGER,
  customised BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS workflow_catalogue_installs_item_idx ON workflow_catalogue_installs(catalogue_item_id);
CREATE INDEX IF NOT EXISTS workflow_catalogue_installs_org_idx ON workflow_catalogue_installs(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_catalogue_installs_workflow_idx ON workflow_catalogue_installs(installed_workflow_id);

CREATE TABLE IF NOT EXISTS workflow_catalogue_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_catalogue_reviews_item_idx ON workflow_catalogue_reviews(catalogue_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_catalogue_reviews_user_item_idx ON workflow_catalogue_reviews(catalogue_item_id, user_id);

CREATE TABLE IF NOT EXISTS workflow_catalogue_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  seller_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  seller_org_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_gbp_pence INTEGER NOT NULL,
  platform_fee_gbp_pence INTEGER NOT NULL,
  creator_payout_gbp_pence INTEGER NOT NULL,
  status workflow_catalogue_purchase_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workflow_catalogue_purchases_item_idx ON workflow_catalogue_purchases(catalogue_item_id);
CREATE INDEX IF NOT EXISTS workflow_catalogue_purchases_buyer_org_idx ON workflow_catalogue_purchases(buyer_org_id);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_catalogue_purchases_session_idx ON workflow_catalogue_purchases(stripe_checkout_session_id);

CREATE TABLE IF NOT EXISTS workflow_catalogue_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_item_id UUID NOT NULL REFERENCES workflow_catalogue_items(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  workflow_definition JSONB NOT NULL,
  changelog TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS workflow_catalogue_versions_item_version_idx ON workflow_catalogue_versions(catalogue_item_id, version_number);

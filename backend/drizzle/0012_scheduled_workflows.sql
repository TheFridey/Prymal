-- 0012_scheduled_workflows.sql
-- Adds durable scheduled workflow execution:
--   - Rich schedule fields on workflows (intervalType, timesPerDay, daysOfWeek, timezone, nextRunAt, scheduleStatus)
--   - scheduled_job_locks for duplicate-safe distributed claim via SELECT FOR UPDATE SKIP LOCKED
--   - approval_mode enum + workflow_post_approvals for draft/approval/auto-publish flow
--   - linkedin_publish_receipts for full execution receipts

DO $$ BEGIN
  CREATE TYPE "approval_mode" AS ENUM ('draft_only', 'approval_required', 'auto_publish');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "approval_status" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "schedule_status" AS ENUM ('idle', 'running', 'paused', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "interval_type" AS ENUM ('hourly', 'daily', 'multiple_times_daily', 'weekly', 'selected_days');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Rich schedule config on workflows
ALTER TABLE "workflows"
  ADD COLUMN IF NOT EXISTS "interval_type" interval_type,
  ADD COLUMN IF NOT EXISTS "times_per_day" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "days_of_week" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC' NOT NULL,
  ADD COLUMN IF NOT EXISTS "next_run_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "schedule_status" schedule_status DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS "approval_mode" approval_mode DEFAULT 'auto_publish',
  ADD COLUMN IF NOT EXISTS "token_encrypted" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "workflows_next_run_idx" ON "workflows" ("next_run_at");
CREATE INDEX IF NOT EXISTS "workflows_schedule_status_idx" ON "workflows" ("schedule_status");

-- Distributed job lock table (one row per workflow, claimed with SELECT FOR UPDATE SKIP LOCKED)
CREATE TABLE IF NOT EXISTS "scheduled_job_locks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "locked_by" text,
  "locked_at" timestamp with time zone,
  "lock_expires_at" timestamp with time zone,
  "last_run_at" timestamp with time zone,
  "last_run_id" uuid,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "last_failure_at" timestamp with time zone,
  "last_failure_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "scheduled_job_locks"
    ADD CONSTRAINT "scheduled_job_locks_workflow_id_workflows_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "scheduled_job_locks"
    ADD CONSTRAINT "scheduled_job_locks_org_id_organisations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_job_locks_workflow_unique" ON "scheduled_job_locks" ("workflow_id");
CREATE INDEX IF NOT EXISTS "scheduled_job_locks_org_idx" ON "scheduled_job_locks" ("org_id");
CREATE INDEX IF NOT EXISTS "scheduled_job_locks_lock_expires_idx" ON "scheduled_job_locks" ("lock_expires_at");

-- Pending post approval requests
CREATE TABLE IF NOT EXISTS "workflow_post_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL,
  "workflow_run_id" uuid NOT NULL,
  "org_id" uuid NOT NULL,
  "created_by_user_id" text,
  "reviewed_by_user_id" text,
  "service" text NOT NULL DEFAULT 'linkedin',
  "post_text" text NOT NULL,
  "post_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" approval_status DEFAULT 'pending' NOT NULL,
  "rejection_reason" text,
  "warden_verdict" text,
  "warden_risk_level" text,
  "expires_at" timestamp with time zone NOT NULL,
  "approved_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "publish_receipt_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "workflow_post_approvals"
    ADD CONSTRAINT "workflow_post_approvals_workflow_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_post_approvals"
    ADD CONSTRAINT "workflow_post_approvals_org_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "workflow_post_approvals_workflow_idx" ON "workflow_post_approvals" ("workflow_id");
CREATE INDEX IF NOT EXISTS "workflow_post_approvals_org_status_idx" ON "workflow_post_approvals" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "workflow_post_approvals_run_idx" ON "workflow_post_approvals" ("workflow_run_id");
CREATE INDEX IF NOT EXISTS "workflow_post_approvals_expires_idx" ON "workflow_post_approvals" ("expires_at");

-- Full publish receipts (LinkedIn and other social posts)
CREATE TABLE IF NOT EXISTS "publish_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL,
  "workflow_run_id" uuid NOT NULL,
  "approval_id" uuid,
  "org_id" uuid NOT NULL,
  "service" text NOT NULL DEFAULT 'linkedin',
  "provider_post_id" text,
  "author_urn" text,
  "post_text" text NOT NULL,
  "post_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "warden_verdict" text,
  "warden_risk_level" text,
  "status" text DEFAULT 'published' NOT NULL,
  "error_message" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "publish_receipts"
    ADD CONSTRAINT "publish_receipts_workflow_id_fk"
    FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "publish_receipts"
    ADD CONSTRAINT "publish_receipts_org_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "publish_receipts_workflow_idx" ON "publish_receipts" ("workflow_id");
CREATE INDEX IF NOT EXISTS "publish_receipts_org_idx" ON "publish_receipts" ("org_id", "created_at");
CREATE INDEX IF NOT EXISTS "publish_receipts_run_idx" ON "publish_receipts" ("workflow_run_id");
CREATE INDEX IF NOT EXISTS "publish_receipts_service_idx" ON "publish_receipts" ("service");

CREATE TABLE IF NOT EXISTS "workflow_risk_confirmation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "user_id" text,
  "workflow_id" uuid NOT NULL,
  "workflow_run_id" uuid,
  "warden_audit_id" uuid,
  "risk_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "used_at" timestamp with time zone
);

DO $$ BEGIN
 ALTER TABLE "workflow_risk_confirmation" ADD CONSTRAINT "workflow_risk_confirmation_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "workflow_risk_confirmation" ADD CONSTRAINT "workflow_risk_confirmation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "workflow_risk_confirmation" ADD CONSTRAINT "workflow_risk_confirmation_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "workflow_risk_confirmation_org_idx" ON "workflow_risk_confirmation" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "workflow_risk_confirmation_workflow_idx" ON "workflow_risk_confirmation" USING btree ("workflow_id");
CREATE INDEX IF NOT EXISTS "workflow_risk_confirmation_status_idx" ON "workflow_risk_confirmation" USING btree ("status");
CREATE INDEX IF NOT EXISTS "workflow_risk_confirmation_expires_idx" ON "workflow_risk_confirmation" USING btree ("expires_at");

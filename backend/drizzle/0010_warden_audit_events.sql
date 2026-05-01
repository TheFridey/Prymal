CREATE TABLE IF NOT EXISTS "warden_audit_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid,
  "user_id" text,
  "surface" text NOT NULL,
  "source_type" text NOT NULL,
  "action" text NOT NULL,
  "verdict" text NOT NULL,
  "risk_level" text NOT NULL,
  "categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "content_hash" text,
  "redaction_count" integer DEFAULT 0 NOT NULL,
  "source_url" text,
  "file_id" text,
  "tool_name" text,
  "provider" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "warden_audit_event" ADD CONSTRAINT "warden_audit_event_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "warden_audit_event" ADD CONSTRAINT "warden_audit_event_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "warden_audit_org_idx" ON "warden_audit_event" USING btree ("org_id","created_at");
CREATE INDEX IF NOT EXISTS "warden_audit_surface_idx" ON "warden_audit_event" USING btree ("surface");
CREATE INDEX IF NOT EXISTS "warden_audit_verdict_idx" ON "warden_audit_event" USING btree ("verdict");
CREATE INDEX IF NOT EXISTS "warden_audit_risk_idx" ON "warden_audit_event" USING btree ("risk_level");
CREATE INDEX IF NOT EXISTS "warden_audit_tool_idx" ON "warden_audit_event" USING btree ("tool_name");

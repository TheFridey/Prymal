DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_event_status') THEN
    CREATE TYPE email_event_status AS ENUM ('pending','sent','skipped','failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "email_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "org_id" uuid,
  "recipient" text NOT NULL,
  "email_type" text NOT NULL,
  "provider" text DEFAULT 'resend' NOT NULL,
  "provider_message_id" text,
  "status" "email_event_status" DEFAULT 'pending' NOT NULL,
  "idempotency_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_events_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "email_events" ADD CONSTRAINT "email_events_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_events_org_id_organisations_id_fk'
  ) THEN
    ALTER TABLE "email_events" ADD CONSTRAINT "email_events_org_id_organisations_id_fk"
      FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "email_events_org_idx" ON "email_events" ("org_id","created_at");
CREATE INDEX IF NOT EXISTS "email_events_user_idx" ON "email_events" ("user_id");
CREATE INDEX IF NOT EXISTS "email_events_type_idx" ON "email_events" ("email_type");
CREATE INDEX IF NOT EXISTS "email_events_status_idx" ON "email_events" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "email_events_idempotency_unique" ON "email_events" ("idempotency_key");

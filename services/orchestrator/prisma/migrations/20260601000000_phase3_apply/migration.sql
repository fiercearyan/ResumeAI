-- Phase 3: auto-apply tables

CREATE TABLE "user_preferences" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "first_name" TEXT,
  "last_name" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "country_code" TEXT,
  "work_auth" TEXT,
  "needs_sponsorship" BOOLEAN,
  "linkedin_url" TEXT,
  "github_url" TEXT,
  "portfolio_url" TEXT,
  "auto_apply_enabled" BOOLEAN NOT NULL DEFAULT false,
  "default_mode" TEXT NOT NULL DEFAULT 'review',
  "min_ats_score" DOUBLE PRECISION NOT NULL DEFAULT 80,
  "daily_apply_cap" INTEGER NOT NULL DEFAULT 5,
  "question_bank" JSONB,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "apply_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "application_id" UUID NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
  "step" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "message" TEXT,
  "screenshot_s3" TEXT,
  "meta" JSONB,
  "at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "apply_events_application_id_at_idx" ON "apply_events"("application_id", "at");

-- Also add the screenshots bucket name placeholder; orchestrator's S3Service will use it.

-- Profile Completion System

CREATE TABLE "profiles" (
  "user_id"           UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "full_name"         TEXT,
  "phone"             TEXT,
  "current_location"  TEXT,
  "linkedin_url"      TEXT,
  "github_url"        TEXT,
  "portfolio_url"     TEXT,
  "job_title"         TEXT,
  "summary"           TEXT,
  "languages"         JSONB NOT NULL DEFAULT '[]'::jsonb,
  "achievements"      TEXT,
  "primary_resume_id" UUID REFERENCES "resumes"("id") ON DELETE SET NULL,
  "completion_pct"    INTEGER NOT NULL DEFAULT 0,
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "profile_experiences" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company"          TEXT NOT NULL,
  "role"             TEXT NOT NULL,
  "start_date"       TEXT,
  "end_date"         TEXT,
  "responsibilities" TEXT,
  "tech_stack"       JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sort_order"       INTEGER NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "profile_experiences_user_id_sort_order_idx" ON "profile_experiences" ("user_id", "sort_order");

CREATE TABLE "profile_education" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "college"    TEXT NOT NULL,
  "degree"     TEXT,
  "branch"     TEXT,
  "start_year" TEXT,
  "end_year"   TEXT,
  "gpa"        TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "profile_education_user_id_sort_order_idx" ON "profile_education" ("user_id", "sort_order");

CREATE TABLE "profile_projects" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "tech_stack"  JSONB NOT NULL DEFAULT '[]'::jsonb,
  "github_url"  TEXT,
  "live_url"    TEXT,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "profile_projects_user_id_sort_order_idx" ON "profile_projects" ("user_id", "sort_order");

CREATE TABLE "profile_skills" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "category"   TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("user_id", "name")
);

CREATE TABLE "profile_certifications" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"           TEXT NOT NULL,
  "issuer"         TEXT,
  "issued_date"    TEXT,
  "credential_url" TEXT,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

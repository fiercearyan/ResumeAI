-- Initial schema for ResumeAI Phase 1

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE "resumes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_type" TEXT NOT NULL,
  "s3_key" TEXT NOT NULL,
  "mongo_doc_id" TEXT NOT NULL,
  "current_version_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "resumes_user_id_idx" ON "resumes"("user_id");

CREATE TABLE "resume_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "resume_id" UUID NOT NULL REFERENCES "resumes"("id") ON DELETE CASCADE,
  "parent_version_id" UUID,
  "label" TEXT,
  "mongo_doc_id" TEXT NOT NULL,
  "s3_pdf_key" TEXT,
  "s3_latex_key" TEXT,
  "created_by" TEXT NOT NULL DEFAULT 'user',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "resume_versions_resume_id_idx" ON "resume_versions"("resume_id");

CREATE TABLE "job_descriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "source_type" TEXT NOT NULL,
  "source_url" TEXT,
  "title" TEXT,
  "company" TEXT,
  "location" TEXT,
  "raw_s3_key" TEXT,
  "parsed_json" JSONB NOT NULL,
  "content_hash" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "job_descriptions_user_id_idx" ON "job_descriptions"("user_id");

CREATE TABLE "ats_scores" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "resume_version_id" UUID NOT NULL REFERENCES "resume_versions"("id") ON DELETE CASCADE,
  "jd_id" UUID NOT NULL REFERENCES "job_descriptions"("id") ON DELETE CASCADE,
  "overall" DOUBLE PRECISION NOT NULL,
  "section_scores" JSONB NOT NULL,
  "matched_skills" JSONB NOT NULL,
  "missing_skills" JSONB NOT NULL,
  "missing_keywords" JSONB NOT NULL,
  "recruiter_fit" DOUBLE PRECISION NOT NULL,
  "rationale" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "ats_scores_jd_overall_idx" ON "ats_scores"("jd_id", "overall" DESC);

CREATE TABLE "applications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "jd_id" UUID NOT NULL REFERENCES "job_descriptions"("id") ON DELETE CASCADE,
  "resume_version_id" UUID NOT NULL REFERENCES "resume_versions"("id") ON DELETE CASCADE,
  "platform" TEXT NOT NULL,
  "external_id" TEXT,
  "status" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'review',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "submitted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "applications_user_id_idx" ON "applications"("user_id");

CREATE TABLE "audit_log" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" UUID,
  "actor" TEXT,
  "action" TEXT NOT NULL,
  "resource_type" TEXT,
  "resource_id" TEXT,
  "ip" TEXT,
  "ua" TEXT,
  "meta" JSONB,
  "at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "audit_log_user_id_at_idx" ON "audit_log"("user_id", "at" DESC);

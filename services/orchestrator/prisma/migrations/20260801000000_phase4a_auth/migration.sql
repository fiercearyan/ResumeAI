-- Phase 4a: OAuth + MFA

-- Users: relax password_hash, add MFA columns.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfa_secret_enc" TEXT;
ALTER TABLE "users" ADD COLUMN "mfa_backup_codes_hash" JSONB;

CREATE TABLE "oauth_identities" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"           UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider"          TEXT NOT NULL,
  "provider_user_id"  TEXT NOT NULL,
  "email"             TEXT,
  "access_token_enc"  TEXT,
  "refresh_token_enc" TEXT,
  "expires_at"        TIMESTAMPTZ,
  "linked_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("provider", "provider_user_id")
);
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities" ("user_id");

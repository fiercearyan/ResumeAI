-- Phase 4b: notifications + billing

CREATE TABLE "notification_log" (
  "id"              BIGSERIAL PRIMARY KEY,
  "user_id"         UUID,
  "email"           TEXT NOT NULL,
  "template"        TEXT NOT NULL,
  "status"          TEXT NOT NULL,
  "idempotency_key" TEXT UNIQUE,
  "meta"            JSONB,
  "error"           TEXT,
  "sent_at"         TIMESTAMPTZ,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "notification_log_user_id_created_at_idx"
  ON "notification_log" ("user_id", "created_at" DESC);

CREATE TABLE "billing_customers" (
  "user_id"                UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "stripe_customer_id"     TEXT UNIQUE,
  "stripe_subscription_id" TEXT UNIQUE,
  "plan"                   TEXT NOT NULL DEFAULT 'free',
  "current_period_end"     TIMESTAMPTZ,
  "status"                 TEXT NOT NULL DEFAULT 'inactive',
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

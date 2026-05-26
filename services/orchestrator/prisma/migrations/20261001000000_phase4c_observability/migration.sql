-- Phase 4c: LLM usage tracking

CREATE TABLE "llm_usage" (
  "id"        BIGSERIAL PRIMARY KEY,
  "user_id"   UUID,
  "service"   TEXT NOT NULL,
  "model"     TEXT NOT NULL,
  "endpoint"  TEXT,
  "in_tokens" INTEGER NOT NULL,
  "out_tokens" INTEGER NOT NULL,
  "cost_usd"  DOUBLE PRECISION NOT NULL,
  "meta"      JSONB,
  "at"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "llm_usage_user_id_at_idx" ON "llm_usage" ("user_id", "at" DESC);
CREATE INDEX "llm_usage_at_idx" ON "llm_usage" ("at" DESC);

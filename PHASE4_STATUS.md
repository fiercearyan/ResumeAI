# ResumeAI — Phase 4a Status

## What landed

**Auth + Security** is the first slice of Phase 4. End-to-end OAuth (Google + GitHub + LinkedIn), TOTP-based MFA, Redis-backed rate limits, server-set security headers, and GDPR self-serve endpoints.

The rest of Phase 4 (notifications + billing, observability, Kafka / Helm) is planned as separate slices — see the bottom of this file.

---

## OAuth

### Providers
- **Google** — real OAuth 2.0 + OIDC userinfo. Scopes: `openid email profile`. Wired and tested.
- **GitHub** — real OAuth 2.0. Scopes: `read:user user:email`. Falls back to `/user/emails` when the primary email isn't public.
- **LinkedIn** — wired identically (`openid profile email`). The button + endpoint are live but LinkedIn's app review is slow, so we treat it as **wired-not-yet-approved**.

### Mock mode
`OAUTH_MOCK=true` (default in `.env`) short-circuits the provider round-trip and returns a synthetic profile from the `/start` redirect. This is what makes local sign-in + 3-way linking work without registering real apps with each provider.

### Account linking — same user, all three providers
This was the trickiest part. Two flows:

1. **Sign in with X (anonymous start)** — `GET /auth/oauth/:provider/start` → redirect to provider → callback resolves the user in priority order:
   1. Existing `(provider, provider_user_id)` identity → that user.
   2. Email lookup against `users` → existing user.
   3. Create new user with the provider's email.
2. **Link from `/settings/account` (authenticated start)** — `POST /auth/oauth/:provider/link-start` with the user's Bearer token. The server validates the JWT, stashes the user-id in the OAuth state map, returns the authorize URL in JSON. The callback sees `state.linkUserId` and **attaches to that user regardless of provider email**. No new tokens issued — the session is unchanged.

This split is what lets Google + GitHub + LinkedIn all coexist on one ResumeAI account even when each provider hands out a different email.

Safety rails:
- If the OAuth identity is already linked to a **different** ResumeAI user, linking 400s with a clear error (no silent account-switching).
- OAuth state map prunes entries after 10 minutes.
- Access / refresh tokens stored encrypted with AES-256-GCM (`ENC_KEY` env var or SHA-256 of `JWT_SECRET` as a dev fallback).

### Endpoints (auth service)

```
GET  /auth/oauth/providers              list enabled providers (used by FE button visibility)
GET  /auth/oauth/:provider/start        redirect-based start (sign-in flow)
POST /auth/oauth/:provider/link-start   JSON start (authenticated link flow)
GET  /auth/oauth/:provider/callback     provider hits this; we 302 → /oauth/finish with tokens in hash
GET  /auth/oauth/identities             list current user's linked providers
POST /auth/oauth/:provider/unlink       remove a linked identity
```

---

## TOTP MFA

### Implementation
- RFC-6238 (SHA-1 HMAC, 30-second step, 6-digit code, ±1 step tolerance) implemented from scratch in `services/auth/src/mfa/totp.ts`. No external TOTP lib.
- Secrets are base32 (RFC-4648 alphabet, no padding), 20 bytes / 160 bits.
- Backup codes: 10 single-use codes generated at enrollment, returned **once**, stored as argon2id hashes. Consumed and removed on use.

### Enrollment flow
1. `POST /auth/mfa/enroll/start` → returns `{ otpauthUrl, secret }`. UI renders a QR via `api.qrserver.com` (no QR lib needed in the bundle).
2. User scans into Google Authenticator / 1Password / Authy / etc.
3. `POST /auth/mfa/enroll/confirm { code }` → verifies, sets `users.mfa_enabled = true`, returns the 10 plaintext backup codes for the user to save.

### Login challenge
- `auth.service.login()` returns `{ mfaRequired: true, challenge }` when `mfa_enabled`. The challenge is a 5-minute JWT (`typ=mfa_challenge`).
- `POST /auth/mfa/verify { challenge, code }` exchanges it for a real session. Accepts either a current TOTP code or a backup code.
- Login UI handles both branches inline (no extra page).
- OAuth flow honors MFA the same way — callback returns `mfaRequired` instead of tokens; the `/oauth/finish` page prompts for the code.

### Disable
- `POST /auth/mfa/disable { code }` — accepts a TOTP or backup code, clears `mfa_enabled` + `mfa_secret_enc` + `mfa_backup_codes_hash`.

---

## Rate limits

`RateLimitMiddleware` is mounted on every route and uses a built-in `LIMITS` map to decide which paths to count. Backed by `INCR` + `EXPIRE` in Redis.

| Endpoint | Limit |
|---|---|
| `POST /auth/signup` | 5 / 60s / IP |
| `POST /auth/login` | 10 / 60s / IP |
| `POST /auth/mfa/verify` | 5 / 60s / IP |
| `POST /auth/mfa/enroll/start` | 5 / 60s / IP |
| `POST /auth/mfa/enroll/confirm` | 5 / 60s / IP |

When breached, returns `429 Too Many Requests` with a structured body.

Fail-open in dev when Redis is unreachable (logged); fail-closed in `NODE_ENV=production`.

---

## Security headers

`SecurityHeadersMiddleware` is mounted globally on the auth service and sends on every response:

```
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'
```

The API CSP is intentionally locked down — auth service doesn't serve HTML. The web app's CSP comes via Next.js config; we'll tighten that with nonces in a follow-up.

---

## GDPR (orchestrator)

Self-serve endpoints under `/api/me`:

| Endpoint | Behavior |
|---|---|
| `GET /api/me/export` | JSON download of every row owned by the user across Postgres + Mongo. Sensitive fields (`passwordHash`, `mfaSecretEnc`, `mfaBackupCodesHash`) scrubbed before serialization. |
| `POST /api/me/delete` | Hard-delete. Wipes from Mongo first (`resume_documents`, `prompt_traces`) then deletes the User row. `ON DELETE CASCADE` on every dependent table handles the rest. Email becomes immediately re-registerable. |

UI is in `/settings/account` → **Danger zone**, with a confirm step on delete.

---

## Schema delta — `20260801000000_phase4a_auth`

```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN mfa_secret_enc TEXT;
ALTER TABLE users ADD COLUMN mfa_backup_codes_hash JSONB;

CREATE TABLE oauth_identities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,            -- google | github | linkedin
  provider_user_id  TEXT NOT NULL,
  email             TEXT,
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  expires_at        TIMESTAMPTZ,
  linked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX oauth_identities_user_id_idx ON oauth_identities(user_id);
```

- `password_hash` is now nullable — OAuth-only users have no password. Login on such accounts returns a friendly "use your provider" 401.
- `mfa_backup_codes_hash` is JSONB string-array of argon2 hashes; codes are removed from the array as they're consumed.

---

## Frontend additions

- `OAuthButtons` component — lights up "Continue with Google / GitHub / LinkedIn" buttons only for providers the server reports as enabled. Used on both `/login` and `/signup`.
- `/oauth/finish` — parses tokens from the URL hash (or `linked=1` for link mode, or `mfa_challenge` for the 2FA prompt). Stores the session in `auth-store` and navigates to `?next`.
- `/settings/account` — three cards:
  1. **Two-factor authentication** — enrollment QR + backup codes display, disable flow.
  2. **Connected accounts** — Google / GitHub / LinkedIn rows with Link / Unlink buttons.
  3. **Danger zone** — export JSON + hard-delete with confirm.
- Login page handles the `mfaRequired` response inline (no separate page).
- Sidebar gets an "Account & security" entry between Auto-apply and Preferences.

---

## Smoke test results

```
[1] OAuth providers list (mock mode)
    providers: [google: enabled, github: enabled, linkedin: enabled]
[2] OAuth start → 302 to /:provider/callback?code=MOCK_…&state=…
[3] Callback → 302 to /oauth/finish?next=/dashboard#access=…&refresh=…&user=…
[4] /auth/me → mfaEnabled=false
[5] MFA enroll/start → otpauth URL + 20-byte secret
[6] MFA enroll/confirm with derived TOTP → 10 backup codes, mfa_enabled=true
[7] Login with password + MFA → mfaRequired+challenge → /mfa/verify → tokens
[8] Rate limit on /auth/login → 10 × 401 then 3 × 429 (Redis key rl:POST_login:<ip>)
[9] Security headers verified on every auth response
[10] GDPR export → 200, sanitized JSON
[11] GDPR delete → cascades; /auth/me → 401 afterwards
[12] Account linking — sign in Google → link GitHub → link LinkedIn → /settings/account
     shows all 3 providers linked to the same user (verified in UI screenshot)
```

---

## Deliberate trade-offs

- **No audit-log signing**. The `audit_log` table exists but rows are not yet HMAC-signed. Low priority for now; lands when we start exposing audit views.
- **No Trusted Types**. CSP on the API is strict; the web app's CSP is still loose to keep dev fast. Tightening requires nonce-aware Next.js config — follow-up.
- **No image rate-limiter / WAF / Cloudflare**. Per-IP Redis counters are enough for dev + early prod.
- **LinkedIn real OAuth** is wired but blocked on app review.
- **Refresh-token rotation** isn't enforced yet. The refresh JWT is reusable until its 7-day TTL elapses; a follow-up will track issued refresh JTIs in Redis and rotate on use.
- **No password reset email**. Mailhog is in the stack but the notifications service ships in Phase 4b.

---

## What's next under Phase 4

| Slice | Scope |
|---|---|
| **4b — Notifications + Billing** | Transactional email (Mailhog locally, Resend in prod); Stripe checkout for Pro plan; webhook handler; per-plan quotas on optimize + apply with circuit breakers |
| **4c — Observability + Evals** | OpenTelemetry across all services → Tempo / Loki / Mimir; LLM cost dashboard; promptfoo nightly evals on the optimizer with CI gate; Sentry |
| **4d — Kafka + Scale Infra** | Redpanda in compose; event-driven refactor of orchestrator → workers; KEDA-style queue-depth scaling; Helm + ArgoCD manifests; additional auto-apply drivers (Lever, real LinkedIn) |

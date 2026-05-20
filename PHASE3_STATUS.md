# ResumeAI — Phase 3 Status

## What landed

**Auto-Apply** — end-to-end Playwright-driven application submission, with a review-mode pause + screenshot trail so the user verifies every form fill before submit.

### New service: `services/auto-apply`

- Node 20 + TS + Playwright, built on `mcr.microsoft.com/playwright:v1.42.1-jammy` (Chromium pre-installed).
- Tiny HTTP server on `:8005` (`/health`, `POST /enqueue`, `POST /resume/:id`) consumed only by the orchestrator.
- Background worker uses **`BLPOP` on a Redis list** as the job queue — no Temporal yet (deferred to Phase 4 when we need durable multi-step workflows).
- State machine on the existing `applications` table:
  `queued → in_progress → awaiting_user → submitted | failed`
- Per-step `apply_events` rows (new table) with optional `screenshot_s3` keys → frontend renders a timeline.
- Driver registry. **Greenhouse driver only** in this phase ([services/auto-apply/src/drivers/greenhouse.ts](services/auto-apply/src/drivers/greenhouse.ts)) — handles `boards.greenhouse.io/*`. Fills `#first_name`/`#last_name`/`#email`/`#phone`/`#resume`, plus label-based fallbacks for LinkedIn / GitHub / portfolio / city. Captcha detection (recaptcha, hcaptcha, Cloudflare Turnstile) → records event, defers submit.
- Lever / LinkedIn / Indeed / Workday deferred (ToS risk + driver complexity).

### Orchestrator additions

[services/orchestrator/src/apply](services/orchestrator/src/apply) + [preferences](services/orchestrator/src/preferences):

- `POST /api/apply {jdId, resumeVersionId, mode}` — enforces a daily cap from user_preferences (default 5/day), detects platform from JD url, refuses non-Greenhouse / text-only JDs, enqueues via HTTP to auto-apply (Redis is the durable store).
- `GET  /api/apply[?status=…]` — list w/ filter, used by the Kanban tracker.
- `GET  /api/apply/:id` — application + full event timeline + **signed screenshot URLs** (10-minute presigned MinIO links).
- `POST /api/apply/:id/approve` — only valid from `awaiting_user`; flips mode to `auto` and re-enqueues with a `resume:` prefix.
- `POST /api/apply/:id/cancel` — terminates with `lastError = "Cancelled by user"`.
- `GET / PATCH /api/preferences` — profile fields (name, phone, city, work auth, links), auto-apply controls (`autoApplyEnabled`, `defaultMode`, `minAtsScore`, `dailyApplyCap`), free-form `questionBank` JSON.

### Schema additions ([migration](services/orchestrator/prisma/migrations/20260601000000_phase3_apply))

```
user_preferences (user_id PK, profile fields, auto_apply_enabled,
                  default_mode review|auto, min_ats_score, daily_apply_cap,
                  question_bank JSONB)
apply_events     (id BIGSERIAL, application_id FK, step, ok, message,
                  screenshot_s3, meta JSONB, at)
```

`applications` table from Phase 1 is unchanged.

### Frontend

- New sidebar entries **Auto-apply** and **Preferences** ([apps/web/components/app-shell.tsx](apps/web/components/app-shell.tsx)).
- `/applications` — 5-column Kanban (queued / in progress / awaiting you / submitted / failed) that auto-refreshes every 4 s.
- `/applications/[id]` — header + timeline with rendered screenshots, status badge, **Approve & submit / Cancel** buttons when status = `awaiting_user`. Polls every 3 s.
- `/settings/preferences` — form-fill profile + auto-apply controls.
- Score page now shows an **Apply with this resume** card that:
  - Disables if JD has no `sourceUrl` (text-only) or hostname isn't Greenhouse.
  - Disables if `overall < user.minAtsScore`.
  - Otherwise queues an application and navigates to its tracker page.

### Compose

- New service `auto-apply` (Playwright base).
- New service `mock-form` (nginx serving `samples/`) exposing a Greenhouse-shaped form at `http://localhost:9100/mock-greenhouse.html` so the smoke test never touches real job boards.
- New bucket `apply-artifacts` for screenshots, created by the existing `minio-init` container.

## Smoke-tested end-to-end

Against `samples/mock-greenhouse.html` (served by the `mock-form` container):

```
review pause: status=awaiting_user after 2s, 6 events, 2 screenshots
approve     : status=submitted     after 2s, 8 events total, 4 screenshots

timeline:
  start
  page_loaded
  screenshot:before_fill   [Y]
  resume_uploaded
  screenshot:after_fill    [Y]
  awaiting_user
  start                    (resume run)
  page_loaded
  screenshot:before_fill   [Y]
  resume_uploaded
  screenshot:after_fill    [Y]
  screenshot:before_submit [Y]
  screenshot:after_submit  [Y]
  submitted
```

The worker re-fills the form on the resume run (browser state isn't persisted across the awaiting_user pause) — idempotent and matches user intent.

## Safety defaults

- **Review mode is default.** The worker pauses before submit and records `awaiting_user`; the user must click Approve & submit. This holds even when `user_preferences.defaultMode == 'auto'` unless the per-application POST explicitly sets `mode: 'auto'`.
- `FORCE_REVIEW_MODE=true` env var on auto-apply hard-overrides any auto submission (handy for org-wide compliance).
- Daily cap default = 5 applications / 24h, configurable per user.
- Captcha detection is built in; submit will be skipped and an event recorded if any of recaptcha / hcaptcha / Cloudflare Turnstile is visible. No auto-solve.
- All driver activity is logged with screenshots before fill, after fill, before submit, after submit — full audit trail.
- LinkedIn / Indeed are deliberately not implemented (ToS risk).

## Phase 3 deliberate trade-offs

- **No Temporal** — Redis BLPOP queue + DB state machine. Good enough for review-mode UX; Temporal is the right call when we add multi-step workflows (auth challenges, account linking, retry policies across many providers) in Phase 4.
- **No persistent BrowserContext** between fill and approve. Re-filling on resume is simpler and safe for the mock form + typical Greenhouse postings. Persistent contexts come back if we need to handle multi-step Workday flows.
- **No question-bank RAG yet** — preferences exposes a `questionBank` JSON field but the driver doesn't yet consult it for free-text screening questions. Wire-up lands when there's enough variety to be worth it.
- **No browser farm pool** — one Playwright instance per application, launched fresh, torn down on completion. Fine until we're running > 5/min.
- **No 2Captcha integration** — detected captchas stop the worker and surface to the user. Opt-in solver lands in Phase 4 behind a paid flag.
- **No screenshots gallery on dashboard** — viewable inline in the application detail page only.
- **No LaTeX → company-required file format conversion** — the optimized PDF from Phase 2 (or the original PDF) is what we upload.

## Run it

If your Phase 1/2 stack is already up, just bring the new containers up:

```bash
docker compose -f infra/compose/docker-compose.yml --env-file .env up -d mock-form auto-apply
docker compose -f infra/compose/docker-compose.yml --env-file .env exec orchestrator npx prisma migrate deploy
docker compose -f infra/compose/docker-compose.yml --env-file .env exec orchestrator npx prisma generate
docker compose -f infra/compose/docker-compose.yml --env-file .env restart orchestrator
```

Fresh start:

```bash
make dev
```

Then:

1. Sign up, set `/settings/preferences` (at minimum: first name, last name, phone, city).
2. Add a JD via **URL** mode pointing at `http://mock-form/mock-greenhouse.html` (or a real `boards.greenhouse.io/*` posting if you want to live-fire).
3. Score it against your resume.
4. Click **Apply with this resume** on the score page → land on `/applications/[id]`.
5. Watch the timeline build live (refreshes every 3 s).
6. When status hits **awaiting you**, review the screenshots and click **Approve & submit** (or Cancel).

## What's next — Phase 4

OAuth/MFA, Stripe billing, Kafka event bus, Qdrant promoted, Resend/Postmark email, Cloudflare WAF + CSP, audit-log signing, Argo CD/EKS, OTel → Tempo/Loki/Mimir, LLM cost dashboard, promptfoo eval suite in CI, and additional drivers (Lever first; LinkedIn behind explicit per-user opt-in + ToS click-through).

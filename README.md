# ResumeAI

AI-powered resume scoring, optimization, and auto-apply SaaS.

## Status

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Upload resume + paste/upload JD → ATS score with section breakdown, matched/missing skills, Claude-written rationale | ✓ shipped |
| **Phase 2** | AI Resume Optimizer — rewrites Summary + top bullets with truth-check guards, surfaces evidenced skills, optimized PDF + `.tex` downloads, auto re-score, side-by-side diff viewer, version promotion | ✓ shipped — [PHASE2_STATUS.md](PHASE2_STATUS.md) |
| **Profile system** | Multi-section profile editor (Personal, Career, Resume, Skills, Experience, Education, Projects, Certifications), header chip with completion ring (orange / amber / green) | ✓ shipped |
| **Phase 3** | Auto-Apply — Playwright worker, Greenhouse driver, daily cap, review-mode default, screenshot audit trail, Kanban tracker | ✓ shipped — [PHASE3_STATUS.md](PHASE3_STATUS.md) |
| **Phase 4a** | OAuth (Google + GitHub + LinkedIn), TOTP MFA, Redis-backed rate limits, security headers, GDPR export + hard-delete | ✓ shipped — [PHASE4_STATUS.md](PHASE4_STATUS.md) |
| **Phase 4b** | Notifications service + Stripe billing + plan-gating | planned |
| **Phase 4c** | OpenTelemetry → Tempo/Loki/Mimir, promptfoo eval suite, LLM cost dashboard | planned |
| **Phase 4d** | Kafka / Redpanda, KEDA-style scaling, Helm/ArgoCD manifests, additional drivers (Lever, real LinkedIn) | planned |

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, shadcn-style components, TanStack Query, Zustand |
| Backend (Node) | NestJS — `auth` and `orchestrator` services |
| Backend (Python) | FastAPI — `resume-parser`, `jd-parser`, `ats-engine`, `ai-optimizer` |
| Auto-apply worker | Node 20 + TS + Playwright (Chromium) + Redis queue |
| LLM | Anthropic Claude (Sonnet 4.6 default, Haiku 4.5 for cheap paths) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (local, free) |
| Data | Postgres (+ pgvector) · MongoDB · Redis · MinIO (S3) |
| Realtime | Socket.IO over WebSockets |
| Auth | JWT (RS-style HMAC), Argon2id, OAuth2 (Google/GitHub/LinkedIn), TOTP MFA, AES-256-GCM token vault |

## Quickstart

Prerequisites: Docker Desktop, Make. No Node/Python required on host — everything runs in containers.

```bash
git init
cp .env.example .env
# add your ANTHROPIC_API_KEY in .env (required for JD parsing & ATS rationale)
make dev
```

Then open:

- Web app: <http://localhost:3000>
- API (Swagger): <http://localhost:4000/api/docs>
- MinIO console: <http://localhost:9001>
- Mailhog: <http://localhost:8025>
- Mock Greenhouse form (for Phase 3 testing): <http://localhost:9100/mock-greenhouse.html>

First-time bring-up takes 5–10 minutes (Docker pulls + npm/pip installs).

### OAuth in dev

By default `.env` sets `OAUTH_MOCK=true`, which lets Google / GitHub / LinkedIn sign-in work with synthetic profiles so you don't need to register real provider apps for local testing.

To use real providers, set `OAUTH_MOCK=false` and fill in:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

Each provider's authorized redirect URI is `http://localhost:4001/auth/oauth/<provider>/callback`.

## Repo Layout

```
apps/web/              Next.js frontend
services/auth          NestJS auth service (JWT, OAuth, TOTP MFA, rate limits)
services/orchestrator  NestJS BFF — REST + WebSocket, Prisma, profile, apply, me/GDPR
services/resume-parser Python FastAPI — parses PDF/DOCX/LaTeX
services/jd-parser     Python FastAPI — parses URL/text/PDF/image
services/ats-engine    Python FastAPI — ATS scoring + Claude judge
services/ai-optimizer  Python FastAPI — planner → rewriter → truth-check → patcher + PDF/LaTeX render
services/auto-apply    Node 20 + Playwright — Greenhouse driver, Redis queue, review-mode
shared/openapi         REST contract
shared/py-common       Shared Python utilities (skills, OCR helpers)
infra/compose          docker-compose dev stack
samples/               Sample resumes, JDs, and the mock-greenhouse.html fixture
tests/golden           Eval set (resume, JD, expected_overall)
```

## Service map (dev ports)

| Service | Internal | Host |
|---|---|---|
| `web`           | `:3000` | `:3000` |
| `orchestrator`  | `:4000` | `:4000` |
| `auth`          | `:4001` | `:4001` |
| `resume-parser` | `:8001` | `:8001` |
| `jd-parser`     | `:8002` | `:8002` |
| `ats-engine`    | `:8003` | `:8003` |
| `ai-optimizer`  | `:8004` | `:8004` |
| `auto-apply`    | `:8005` | `:8005` |
| `postgres`      | `:5432` | `:5432` |
| `mongo`         | `:27017` | `:27018` (remapped to avoid host collision) |
| `redis`         | `:6379` | `:6379` |
| `minio`         | `:9000` | `:9000` (API) + `:9001` (console) |
| `mailhog`       | `:1025/:8025` | `:1025/:8025` |
| `mock-form`     | `:80` | `:9100` |

## Useful Commands

```bash
make dev      # bring up the full stack
make logs     # tail logs
make ps       # container status
make down     # stop everything
make migrate  # run db migrations
make test     # run all unit tests
make nuke     # destroy all data (use with care)
```

## End-to-end happy path

1. Sign up — either email/password or **Continue with Google / GitHub / LinkedIn** (mock by default).
2. Header shows your initials avatar + completion ring at 0% (orange).
3. Click the chip → `/profile`. Fill out Personal, Career, Resume (upload), Skills, Experience, Education, Projects, Certifications. Ring updates per section save: orange → amber → green at 100%.
4. (Optional) `/settings/account` → enable **TOTP MFA** with a QR + 10 backup codes.
5. (Optional) `/settings/account` → link all three OAuth providers to the same account.
6. `/resumes` → upload a resume.
7. `/jobs` → add a JD via URL (try `http://mock-form/mock-greenhouse.html` for a safe local target) or paste text.
8. From the resume detail page, run **ATS score** → land on `/score/:id` with the ring + sub-scores + matched/missing chips + Claude-written rationale.
9. Click **Optimize resume** → land on `/optimize/:versionId` with old-vs-new ring + word-level diff + PDF/`.tex` downloads + Promote-to-current.
10. Click **Apply with this resume** → land on `/applications/:id`. Watch the timeline build live (screenshots inline). When status hits `awaiting you`, review and click **Approve & submit**.
11. `/settings/account` → Danger zone → **Download my data (JSON)** for GDPR export, or **Delete my account** for hard-delete.

## Known limitations

- LinkedIn OAuth is wired but real provider approval is typically slow; mock mode covers it.
- Greenhouse driver only; Lever / Workday deferred to Phase 4d.
- LaTeX is parsed but compiled via WeasyPrint, not real `pdflatex` (gVisor-sandboxed compile is on the roadmap).
- OCR uses Tesseract — PaddleOCR upgrade in a follow-up.
- No Kafka / Qdrant / Temporal yet — those land in Phase 4d.

## Phase docs

- [PHASE2_STATUS.md](PHASE2_STATUS.md) — AI Resume Optimizer
- [PHASE3_STATUS.md](PHASE3_STATUS.md) — Auto-Apply
- [PHASE4_STATUS.md](PHASE4_STATUS.md) — OAuth + MFA + rate limits + security headers + GDPR

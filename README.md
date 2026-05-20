# ResumeAI

AI-powered resume scoring, optimization, and auto-apply SaaS.

This repo is being built in 4 phases (see `/Users/aryansingh/.claude/plans/i-want-yo-to-jaunty-pudding.md`):

- **Phase 1:** Upload resume + paste/upload JD → ATS score with section breakdown, matched/missing skills, and a Claude-written rationale. ✓
- **Phase 2 (current):** AI Resume Optimizer — rewrites Summary + top bullets with truth-check guards, surfaces evidenced skills, optimized PDF + .tex downloads, auto re-score, side-by-side diff viewer, version promotion. ✓ (see [PHASE2_STATUS.md](PHASE2_STATUS.md))
- **Phase 3:** Auto-Apply to Greenhouse / Lever / LinkedIn / Indeed.
- **Phase 4:** Hardening, OAuth/MFA, billing, Kafka, observability, Kubernetes.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend (Node):** NestJS — `auth` and `orchestrator` services
- **Backend (Python):** FastAPI — `resume-parser`, `jd-parser`, `ats-engine`
- **LLM:** Anthropic Claude (Sonnet 4.6 default, Haiku 4.5 cheap path)
- **Embeddings:** `sentence-transformers/all-MiniLM-L6-v2` (local, free)
- **Data:** Postgres (+ pgvector) · MongoDB · Redis · MinIO (S3)
- **Realtime:** Socket.IO over WebSockets

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

First-time bring-up takes 5–10 minutes (Docker pulls + npm/pip installs).

## Repo Layout

```
apps/web/              # Next.js frontend
services/auth          # NestJS auth service (JWT)
services/orchestrator  # NestJS BFF + REST + WebSocket
services/resume-parser # Python FastAPI — parses PDF/DOCX/LaTeX
services/jd-parser     # Python FastAPI — parses URL/text/PDF/image
services/ats-engine    # Python FastAPI — ATS scoring + Claude judge
services/ai-optimizer  # Python FastAPI — planner → rewriter → truthcheck → patcher + PDF/LaTeX render
shared/openapi         # REST contract
shared/py-common       # shared Python utilities (skills, OCR helpers)
infra/compose          # docker-compose dev stack
samples/               # sample resumes & JDs
tests/golden           # eval set (resume, JD, expected_overall)
```

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

## Known Phase 1 Limitations

- No OAuth, MFA, or password reset yet (Phase 4).
- LaTeX parsed but not compiled — compile lands in Phase 2 (sandboxed).
- OCR uses Tesseract (PaddleOCR upgrade in Phase 2).
- No Qdrant / Kafka / Temporal yet (Phase 2+).
- Optimizer button is shown but disabled with "Coming in Phase 2."
- Auto-apply tab is hidden until Phase 3.

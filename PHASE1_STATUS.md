# ResumeAI — Phase 1 Status

## What was built

A working **upload → score → recommendations** vertical slice:

- **Frontend** (Next.js 14, App Router, TS, Tailwind, shadcn-style components)
  - Marketing landing, signup, login
  - Dashboard, resumes list + upload (drag/drop, PDF/DOCX/LaTeX), resume detail, JDs list + ingest (URL or text), score detail (ring + section bars + chips + Claude rationale)
  - Dark mode, responsive, TanStack Query, Zustand auth store, WebSocket wiring ready

- **Backend (Node, NestJS)**
  - `auth` — signup / login / refresh / verify / me, Argon2id, JWT, Postgres via pg
  - `orchestrator` — REST API + Socket.IO gateway, Swagger at `/api/docs`, AuthGuard via the auth service, Prisma against Postgres, MongoDB for parsed docs, MinIO for raw files

- **Backend (Python, FastAPI)**
  - `resume-parser` — PDF (pdfplumber + PyMuPDF fallback), DOCX (python-docx), LaTeX (pylatexenc) → normalized JSON-Resume superset + skill extraction
  - `jd-parser` — URL fetch + trafilatura, or raw text; structured extraction via Claude Haiku 4.5 with `tool_use`; heuristic fallback if no API key
  - `ats-engine` — deterministic sub-scores (hard skill, nice-to-have, keyword density, experience relevance, education, formatting) + semantic similarity (sentence-transformers MiniLM, local + free) + Claude Sonnet 4.6 readability judge + rationale

- **Data**
  - Postgres + pgvector (single Prisma schema migrates on orchestrator boot)
  - MongoDB for resume documents and prompt traces
  - Redis (sessions + cache placeholders)
  - MinIO (auto-creates `resumes-raw` and `jds-raw` buckets via `minio-init`)
  - Mailhog (for future email)

- **DevOps**
  - One-shot `make dev` brings the full stack up via Docker Compose
  - Healthchecks, dependency ordering, volume mounts for hot reload
  - Sensible port bindings (mongo remapped to 27018 externally to avoid collisions)

## How to run

```bash
cd /Users/aryansingh/Downloads/ResumeAI
cp .env.example .env
# Optional but recommended: edit .env and set ANTHROPIC_API_KEY
make dev
```

Then open:

- Web: <http://localhost:3000>
- API docs: <http://localhost:4000/api/docs>
- MinIO console: <http://localhost:9001> (resumeai / resumeai_dev_secret)

First boot takes 5–10 min (Docker image pulls + npm/pip installs + sentence-transformers model download). Subsequent boots are near-instant.

## Smoke-test flow

1. Go to <http://localhost:3000>, click **Get started**, sign up.
2. Land on `/dashboard`. Click **Upload** under "Get started".
3. Drag `samples/sample-resume.tex` into the upload zone. Wait ~2 s for parsing.
4. Navigate to **Job descriptions**. Switch to **Text** mode and paste the contents of `samples/sample-jd.txt`. Click **Save and parse**.
5. Back on **Resumes**, click your resume → click "Run ATS score".
6. You land on the score page with the ring, section bars, matched/missing skill chips, and the Claude-written rationale.

If you set `ANTHROPIC_API_KEY` in `.env`, the JD extraction and rationale are produced by Claude. If you didn't, the system gracefully falls back to a heuristic (a banner explains it on the score page).

## Phase 1 deliberate trade-offs

- **No OAuth/MFA** — email/password only; OAuth lands in Phase 4.
- **Local embeddings** — sentence-transformers MiniLM instead of voyage-3. Free, no API key, ~80MB model. Easy to swap later.
- **OCR not in path** — phase 1 doesn't include scanned-PDF OCR (PaddleOCR ships in Phase 2 alongside the optimizer).
- **No LaTeX compile** — `.tex` is parsed but not recompiled. Compile in a sandboxed container ships with the optimizer (Phase 2).
- **No Kafka/Temporal** — synchronous HTTP between services for now; Kafka enters in Phase 4 with the event-driven refactor.
- **No Sentry/OTel exporters** — wired through code but not configured against real backends; toggle via env in Phase 4.

## Known caveats on this host

- Port 27017 is taken by another Docker mongo container; ours binds host:**27018** instead. Internal docker network is unaffected.
- `mailhog` warns about `linux/amd64` vs `linux/arm64`; harmless on Apple Silicon — it runs fine.

## What's next (Phase 2 entry point)

Add `services/ai-optimizer` (Python LangGraph) and `services/latex-compiler` (sandboxed). Hook the "Optimize (Phase 2)" button (already rendered, disabled) to the new endpoint. Add the diff viewer + version promote/rollback UI.

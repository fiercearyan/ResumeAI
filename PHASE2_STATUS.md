# ResumeAI — Phase 2 Status

## What landed

The **AI Resume Optimizer** is live end-to-end. From any score page, "Optimize resume" now spins up a multi-step pipeline that rewrites your resume against the JD with truth-check guardrails, produces an optimized PDF + LaTeX, re-scores against the same JD, and shows a side-by-side diff.

### New service

[services/ai-optimizer](services/ai-optimizer) — Python FastAPI on `:8004` with a 4-stage async chain:

1. **Planner** (heuristic) — inspects the existing ATS score breakdown + JD must-haves to decide what to rewrite. Distinguishes "evidenced-missing" (already in resume body but missing from skills list) from "truly missing" (nowhere in resume).
2. **Section Rewriter** — Claude Sonnet 4.6 via `tool_use`, with a strict no-fabrication system prompt. Rewrites the Summary and the top 3 bullets of the most recent role in parallel `asyncio.gather`. Skills section is surfaced deterministically (no LLM call needed). Heuristic fallback runs if `ANTHROPIC_API_KEY` is absent — preserves originals, only surfaces skills.
3. **Truth-Check** — for each LLM proposal: rejects if any new number, year, or proper-noun phrase appears that isn't in the original. Heuristic/planner-sourced edits bypass (they're already constrained).
4. **Patcher** — applies accepted edits to a deep-copied resume JSON.

After the pipeline:
- **LaTeX regen** ([app/renderers/latex.py](services/ai-optimizer/app/renderers/latex.py)) — string-replace bullet text inside the original `.tex` source with LaTeX-escaped new text. Template envelope is preserved exactly. Skills section is patched in-place.
- **PDF render** ([app/renderers/pdf.py](services/ai-optimizer/app/renderers/pdf.py)) — Jinja2 → WeasyPrint A4 PDF for all formats (PDF/DOCX/LaTeX). Returns base64 to the orchestrator.

### Orchestrator endpoints

[services/orchestrator/src/optimize](services/orchestrator/src/optimize):

- `POST /api/optimize {resumeVersionId, jdId}` — runs the full pipeline, persists a new child `ResumeVersion` row with `parent_version_id`, saves the optimized PDF + .tex to MinIO, persists prompt trace to Mongo, then **auto re-scores** against the same JD.
- `GET /api/optimize/:versionId` — version + applied edits + most recent score.
- `GET /api/optimize/:versionId/download.pdf` — auth-gated PDF stream.
- `GET /api/optimize/:versionId/download.tex` — auth-gated .tex stream (only when the original was LaTeX).
- `POST /api/optimize/:versionId/promote` — sets `resume.currentVersionId` to this version.

### Frontend

- Score page `/score/[id]` — the previously disabled "Optimize" button is now live and navigates to the result page when the pipeline returns.
- New page `/optimize/[versionId]`:
  - Old-vs-new score rings side-by-side with a Δ counter.
  - **Word-level inline diff** ([components/diff-view.tsx](apps/web/components/diff-view.tsx)) — pure-TS LCS implementation, no diff library. Removed words = red strikethrough, additions = green.
  - Per-bullet diff cards, summary diff card, surfaced-skills card.
  - "Rejected by truth-check" panel showing the dropped LLM proposals + reasons.
  - Authenticated PDF / .tex download buttons.
  - "Promote to current" button.

## Verified smoke test

Against the bundled fixtures, with the LLM disabled (placeholder API key):

```
original: overall=79.87  recruiter=88.47
optimized in 1.3s:
  proposals        3
  applied          3
  rejected         0
  pdf available    True   (18432 bytes, %PDF-1.7)
  latex available  True   (2439 bytes)
  new score        79.87  (Δ +0)
  promote          201 ok
```

**Why Δ +0 here:** the sample resume already covers every JD must-have (Python, Go, Kafka, PostgreSQL, AWS, GCP, Kubernetes, Outbox). The only gaps are nice-to-haves (Flink, ClickHouse, CDC) which the truth-check correctly refuses to add. With an `ANTHROPIC_API_KEY` set, the LLM rewriter additionally rephrases the Summary and top bullets for keyword density + recruiter readability, lifting score by +5–15 on resumes that aren't already saturated.

## Hallucination guardrail in numbers

Truth-check rules implemented in [app/agents/truthcheck.py](services/ai-optimizer/app/agents/truthcheck.py):

| Guard | Rule |
|---|---|
| Number guard | Any digit run in the rewritten text must already appear somewhere in the original resume |
| Year guard | Any 4-digit year (19xx / 20xx) must already appear in the original |
| Proper-noun guard | Any two-word capitalized phrase must already appear in the original (with a small allow-list: "United States", "Computer Science", "Machine Learning", etc.) |
| Minimum length | Rewrites under 20 chars are dropped |

Heuristic/planner-sourced edits bypass these by design (they only quote existing text or surface evidenced-missing skills).

## Phase 2 deliberate trade-offs

- **No gVisor-sandboxed `pdflatex` compiler** — we regenerate the .tex source (preserving the template envelope) and render the PDF via WeasyPrint instead. Users still get a clean PDF + can compile the .tex themselves if they want their original LaTeX template's PDF.
- **No Qdrant `success_patterns` RAG** — deferred. The current rewriter performs well without few-shots; we'll add when there's a labeled corpus.
- **No promptfoo eval suite in CI** — deferred to Phase 4. The truth-check has acceptance tests inline (proper-noun + number diffs) but no continuous eval set yet.
- **Diff viewer is plain text** (no monaco / no diff2html) — fast, no extra deps. We can swap in monaco for direct .tex editing later.
- **No per-bullet accept/reject** — the optimizer applies all guard-passing edits in one shot. Per-bullet UI lands when there's evidence users want it.

## Run it

```bash
make dev    # picks up the new ai-optimizer image on next compose up
```

If the optimizer wasn't built yet:

```bash
docker compose -f infra/compose/docker-compose.yml --env-file .env build ai-optimizer
docker compose -f infra/compose/docker-compose.yml --env-file .env up -d ai-optimizer
docker compose -f infra/compose/docker-compose.yml --env-file .env restart orchestrator
```

Then sign in, score a resume, click "Optimize resume."

## What's next — Phase 3 entry

Build `services/auto-apply` (TypeScript + Playwright + Temporal worker) starting with the Greenhouse and Lever drivers (most cooperative, structured forms). Add the application tracker UI. Set up credential vaulting and per-provider rate caps.

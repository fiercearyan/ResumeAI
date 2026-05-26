# AI Optimizer eval suite

A promptfoo regression suite that hits the live `ai-optimizer` HTTP
endpoint, so it covers the full pipeline (planner → rewriter → truth-check
→ patcher → renderer), not just raw prompts.

## Run locally

```bash
# Bring up the stack first.
cd ../../..
make dev

# Install promptfoo (one-off).
npm install -g promptfoo@latest

# Run the suite.
cd services/ai-optimizer/evals
promptfoo eval
```

## CI

Runs nightly via [.github/workflows/optimizer-evals.yml](../../../.github/workflows/optimizer-evals.yml)
and on every PR that touches `services/ai-optimizer/**`.

A failing eval blocks the PR. Update test cases here when prompts change
intentionally.

## What's covered

| Test | Asserts |
|---|---|
| **No fabrication** | Every rewritten bullet contains only proper-noun phrases already in the original resume (plus a small allow-list of common phrases). |
| **Skills surfacing** | When a JD must-have appears in the resume body but is missing from the skills section, the optimizer surfaces it. |
| **Truthful summary** | A rewritten summary introduces no new numeric values that weren't in the original. |
| **Always emits PDF** | `pdf_b64` is non-empty on every call (WeasyPrint render path). |
| **Rejection invariant** | Every entry in `rejected[]` carries a `_rejected_reason` so the UI can render it. |

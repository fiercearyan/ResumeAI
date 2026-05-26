"""LLM usage logger.

Fire-and-forget HTTP to the orchestrator's internal /api/_internal/llm-usage
endpoint. Computes USD cost from the model's published per-MTok rate, with
sensible defaults that can be overridden via env.

Never throws — usage tracking failure must not break the user-facing call.
"""
import os
import time
import httpx

ORCHESTRATOR_URL = os.environ.get("ORCHESTRATOR_INTERNAL_URL", "http://orchestrator:4000")

# Per-million-token USD. Numbers are conservative estimates; override via env
# if you want exact prices for your account.
DEFAULT_RATES = {
    "claude-sonnet-4-6":          {"in": 3.0,  "out": 15.0},
    "claude-haiku-4-5-20251001":  {"in": 0.8,  "out": 4.0},
    "claude-haiku-4-5":           {"in": 0.8,  "out": 4.0},
    "claude-opus-4-7":            {"in": 15.0, "out": 75.0},
}


def estimate_cost_usd(model: str, in_tokens: int, out_tokens: int) -> float:
    rates = DEFAULT_RATES.get(model, {"in": 3.0, "out": 15.0})
    return round((in_tokens * rates["in"] + out_tokens * rates["out"]) / 1_000_000, 6)


async def record(
    *,
    service: str,
    model: str,
    in_tokens: int,
    out_tokens: int,
    user_id: str | None = None,
    endpoint: str | None = None,
    meta: dict | None = None,
) -> None:
    cost = estimate_cost_usd(model, in_tokens, out_tokens)
    body = {
        "userId": user_id,
        "service": service,
        "model": model,
        "endpoint": endpoint,
        "inTokens": in_tokens,
        "outTokens": out_tokens,
        "costUsd": cost,
        "meta": meta or {},
    }
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            await c.post(f"{ORCHESTRATOR_URL}/api/_internal/llm-usage", json=body)
    except Exception:
        # Fire-and-forget; never raise.
        pass


def extract_usage(resp) -> tuple[int, int]:
    """Pull in/out token counts from an Anthropic Messages response."""
    try:
        return int(resp.usage.input_tokens or 0), int(resp.usage.output_tokens or 0)
    except Exception:
        return 0, 0

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from .pipeline import optimize_resume

app = FastAPI(title="ai-optimizer", version="0.2.0")


class OptimizeBody(BaseModel):
    resume: Dict[str, Any]
    jd: Dict[str, Any]
    score: Dict[str, Any] | None = None
    original_latex: str | None = None


@app.get("/health")
def health():
    return {"ok": True, "service": "ai-optimizer"}


@app.post("/optimize")
async def optimize(body: OptimizeBody):
    try:
        return await optimize_resume(
            resume=body.resume,
            jd=body.jd,
            score=body.score or {},
            original_latex=body.original_latex,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {e}") from e

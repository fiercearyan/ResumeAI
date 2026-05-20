from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from .pipeline import optimize_resume
from .renderers.pdf import render_pdf

app = FastAPI(title="ai-optimizer", version="0.3.0")


class OptimizeBody(BaseModel):
    resume: Dict[str, Any]
    jd: Dict[str, Any]
    score: Dict[str, Any] | None = None
    original_latex: str | None = None


class RenderBody(BaseModel):
    resume: Dict[str, Any]


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


@app.post("/render-pdf")
def render(body: RenderBody):
    """Render a parsed resume to a base64 PDF.

    Used by the auto-apply worker when the version doesn't yet have an
    optimized PDF and the original upload format is .tex or .docx — Greenhouse
    requires PDF/DOC/DOCX/TXT/RTF, so we always upload a real PDF.
    """
    try:
        return {"pdf_b64": render_pdf(body.resume)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF render failed: {e}") from e

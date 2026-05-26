from .observability import init_sentry
init_sentry("ats-engine")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from .scoring import score_resume_against_jd

app = FastAPI(title="ats-engine", version="0.1.0")


class ScoreBody(BaseModel):
    resume: Dict[str, Any]
    jd: Dict[str, Any]


@app.get("/health")
def health():
    return {"ok": True, "service": "ats-engine"}


@app.post("/score")
async def score(body: ScoreBody):
    try:
        return await score_resume_against_jd(body.resume, body.jd)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}") from e

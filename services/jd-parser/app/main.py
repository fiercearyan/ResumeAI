from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Literal
from .fetch import fetch_url_text
from .extract import structured_extract

app = FastAPI(title="jd-parser", version="0.1.0")


class ParseBody(BaseModel):
    type: Literal["url", "text"]
    payload: str


@app.get("/health")
def health():
    return {"ok": True, "service": "jd-parser"}


@app.post("/parse")
async def parse(body: ParseBody):
    if body.type == "url":
        try:
            text = await fetch_url_text(body.payload)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Fetch failed: {e}") from e
        if not text or len(text.strip()) < 50:
            raise HTTPException(status_code=400, detail="JD body too short — could not parse the page.")
    else:
        text = body.payload

    text = text.strip()[:30_000]  # cap to keep LLM cost bounded
    structured = await structured_extract(text, source_url=body.payload if body.type == "url" else None)
    structured["raw_text"] = text
    return structured

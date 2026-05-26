from .observability import init_sentry
init_sentry("resume-parser")

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from .parsers.pdf import parse_pdf
from .parsers.docx_parser import parse_docx
from .parsers.latex_parser import parse_latex
from .normalizer import normalize
from .skills import extract_skills

app = FastAPI(title="resume-parser", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True, "service": "resume-parser"}


@app.post("/parse")
async def parse(
    file: UploadFile = File(...),
    source_type: str = Form(...),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        if source_type == "pdf":
            raw = parse_pdf(data)
        elif source_type == "docx":
            raw = parse_docx(data)
        elif source_type == "latex":
            raw = parse_latex(data.decode("utf-8", errors="ignore"))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported source_type: {source_type}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Parse error: {e}") from e

    normalized = normalize(raw)
    normalized["skills_extracted"] = extract_skills(
        " ".join(
            [
                normalized.get("summary", "") or "",
                " ".join(b for exp in normalized.get("experience", []) for b in exp.get("bullets", [])),
                " ".join(b for prj in normalized.get("projects", []) for b in prj.get("bullets", [])),
                " ".join(normalized.get("skills", [])),
            ]
        )
    )
    return normalized

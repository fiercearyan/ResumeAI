"""End-to-end optimization pipeline.

Planner  → produces an editing plan (which sections, which keywords to surface).
Rewriter → asks Claude to rewrite Summary + top Experience bullets + Skills,
           under a strict no-fabrication system prompt with structured outputs.
TruthCheck → entity, date, and number guards. Rejects bullets that introduce
             new companies, degrees, dates, or numeric claims.
Patcher  → applies accepted edits to a deep-copied resume JSON.
Renderer → produces an optimized .tex (when source was LaTeX) and a WeasyPrint
           PDF (always).
"""
from __future__ import annotations
import copy
import time
from typing import Any, Dict, List
from .agents.planner import build_plan
from .agents.rewriter import rewrite_all
from .agents.truthcheck import filter_safe_edits
from .renderers.latex import regenerate_latex
from .renderers.pdf import render_pdf


async def optimize_resume(
    resume: Dict[str, Any],
    jd: Dict[str, Any],
    score: Dict[str, Any],
    original_latex: str | None,
) -> Dict[str, Any]:
    started = time.time()

    plan = build_plan(resume=resume, jd=jd, score=score)
    proposals = await rewrite_all(resume=resume, jd=jd, plan=plan)
    safe = filter_safe_edits(original=resume, proposals=proposals)
    new_resume = _apply(resume, safe)

    new_latex: str | None = None
    if original_latex and resume.get("source_format") == "latex":
        new_latex = regenerate_latex(
            original_source=original_latex,
            original_resume=resume,
            new_resume=new_resume,
        )
    elif resume.get("source_format") == "latex":
        new_latex = regenerate_latex(
            original_source=resume.get("latex_source", ""),
            original_resume=resume,
            new_resume=new_resume,
        )

    pdf_bytes_b64 = render_pdf(new_resume)

    return {
        "duration_ms": int((time.time() - started) * 1000),
        "plan": plan,
        "proposals": proposals,
        "applied": safe,
        "rejected": [p for p in proposals if p["id"] not in {a["id"] for a in safe}],
        "new_resume": new_resume,
        "new_latex": new_latex,
        "pdf_b64": pdf_bytes_b64,
    }


def _apply(resume: Dict[str, Any], edits: List[Dict[str, Any]]) -> Dict[str, Any]:
    new = copy.deepcopy(resume)
    new.setdefault("experience", [])
    new.setdefault("projects", [])
    for edit in edits:
        target = edit["target"]
        if target == "summary":
            new["summary"] = edit["new_text"]
        elif target == "skills":
            # Union of original skills + newly surfaced ones (already validated).
            existing = {s.lower() for s in new.get("skills", [])}
            for s in edit.get("new_items", []):
                if s.lower() not in existing:
                    new.setdefault("skills", []).append(s)
                    existing.add(s.lower())
        elif target == "experience_bullet":
            exp_idx = edit["section_index"]
            bullet_idx = edit["bullet_index"]
            if 0 <= exp_idx < len(new["experience"]):
                bullets = new["experience"][exp_idx].setdefault("bullets", [])
                if 0 <= bullet_idx < len(bullets):
                    bullets[bullet_idx] = edit["new_text"]
        elif target == "project_bullet":
            prj_idx = edit["section_index"]
            bullet_idx = edit["bullet_index"]
            if 0 <= prj_idx < len(new["projects"]):
                bullets = new["projects"][prj_idx].setdefault("bullets", [])
                if 0 <= bullet_idx < len(bullets):
                    bullets[bullet_idx] = edit["new_text"]
    return new

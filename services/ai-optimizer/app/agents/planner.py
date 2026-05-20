"""Heuristic planner — decides what to rewrite and which keywords to surface.

Deterministic (no LLM call): inspects the existing ATS score breakdown and JD
must-haves to decide which sections to touch. Saves an LLM call on each
optimization request.
"""
from __future__ import annotations
import re
from typing import Any, Dict, List


def build_plan(resume: Dict[str, Any], jd: Dict[str, Any], score: Dict[str, Any]) -> Dict[str, Any]:
    must = list(jd.get("must_haves") or [])
    nice = list(jd.get("nice_to_haves") or [])
    matched = set(s.lower() for s in (score.get("matched_skills") or []))
    missing_must = [m for m in must if m.lower() not in matched]

    resume_text = _flatten_resume(resume).lower()
    # A skill is "evidenced" if it appears anywhere in resume text — we may
    # still surface it in the skills section even if missing there.
    evidenced_missing = [m for m in missing_must if m.lower() in resume_text]
    truly_missing = [m for m in missing_must if m.lower() not in resume_text]

    # Find top experience bullets to rewrite (most-recent role, up to 3 bullets).
    exp = resume.get("experience") or []
    bullet_targets: List[Dict[str, Any]] = []
    if exp:
        bullets = exp[0].get("bullets") or []
        for i, b in enumerate(bullets[:3]):
            bullet_targets.append({"section_index": 0, "bullet_index": i, "text": b})

    return {
        "must_haves": must,
        "nice_to_haves": nice,
        "missing_must": missing_must,
        "evidenced_missing_skills": evidenced_missing,
        "truly_missing_skills": truly_missing,
        "rewrite_summary": True,
        "rewrite_bullets": bullet_targets,
        "surface_skills": evidenced_missing,
    }


def _flatten_resume(resume: Dict[str, Any]) -> str:
    parts = [resume.get("summary") or ""]
    for e in resume.get("experience") or []:
        parts.append(e.get("title") or "")
        parts.append(e.get("company") or "")
        parts.extend(e.get("bullets") or [])
    for p in resume.get("projects") or []:
        parts.append(p.get("title") or "")
        parts.extend(p.get("bullets") or [])
    parts.extend(resume.get("skills") or [])
    parts.extend(resume.get("skills_extracted") or [])
    return " ".join(parts)

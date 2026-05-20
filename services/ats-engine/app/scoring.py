"""ATS scoring engine — Phase 1.

Combines deterministic sub-scores (skill coverage, keyword density, experience
relevance, formatting) with a semantic similarity component (sentence embeddings)
and a Claude judge for readability + rationale.
"""
from __future__ import annotations
import re
import os
from typing import Any, Dict, List, Tuple
import numpy as np
from .embeddings import embed, cosine_matrix
from .judge import readability_and_rationale

WEIGHTS = {
    "hard_skill": 0.25,
    "nice_to_have": 0.08,
    "keyword": 0.12,
    "semantic": 0.20,
    "experience": 0.15,
    "education": 0.05,
    "formatting": 0.10,
    "readability": 0.05,
}

SEMANTIC_COVER_THRESHOLD = 0.55
SEMANTIC_PARTIAL_THRESHOLD = 0.40


async def score_resume_against_jd(resume: Dict[str, Any], jd: Dict[str, Any]) -> Dict[str, Any]:
    resume_skills = _collect_resume_skills(resume)
    jd_musts = [s for s in jd.get("must_haves", []) if s]
    jd_nice = [s for s in jd.get("nice_to_haves", []) if s]
    jd_keywords = [k for k in jd.get("keywords", []) if k]

    matched_must, missing_must = _coverage(jd_musts, resume_skills, full_resume_text(resume))
    matched_nice, missing_nice = _coverage(jd_nice, resume_skills, full_resume_text(resume))

    hard_sub = _percent(len(matched_must), len(jd_musts))
    nice_sub = _percent(len(matched_nice), len(jd_nice)) if jd_nice else 75.0

    keyword_sub, missing_kw = _keyword_density(jd_keywords, resume)
    semantic_sub, per_req = _semantic_similarity(jd, resume)
    experience_sub = _experience_relevance(jd, resume)
    education_sub = _education_score(jd, resume)
    formatting_sub = _formatting_compliance(resume)

    readability_sub, rationale = await readability_and_rationale(
        resume=resume,
        jd=jd,
        sub_scores={
            "hard_skill": hard_sub,
            "nice_to_have": nice_sub,
            "keyword": keyword_sub,
            "semantic": semantic_sub,
            "experience": experience_sub,
            "education": education_sub,
            "formatting": formatting_sub,
        },
        matched_must=matched_must,
        missing_must=missing_must,
    )

    sub_scores = {
        "hard_skill": round(hard_sub, 2),
        "nice_to_have": round(nice_sub, 2),
        "keyword": round(keyword_sub, 2),
        "semantic": round(semantic_sub, 2),
        "experience": round(experience_sub, 2),
        "education": round(education_sub, 2),
        "formatting": round(formatting_sub, 2),
        "readability": round(readability_sub, 2),
    }
    overall = round(sum(sub_scores[k] * w for k, w in WEIGHTS.items()), 2)

    recruiter_fit = round(
        0.5 * overall + 0.3 * experience_sub + 0.2 * hard_sub, 2
    )

    return {
        "overall": overall,
        "section_scores": sub_scores,
        "matched_skills": matched_must,
        "missing_skills": missing_must,
        "missing_keywords": missing_kw,
        "recruiter_fit": recruiter_fit,
        "rationale": rationale,
        "per_requirement": per_req,
    }


# --- sub-score implementations ---------------------------------------------

def _collect_resume_skills(resume: Dict[str, Any]) -> List[str]:
    out: List[str] = []
    out.extend(resume.get("skills", []) or [])
    out.extend(resume.get("skills_extracted", []) or [])
    return _dedupe(out)


def full_resume_text(resume: Dict[str, Any]) -> str:
    parts: List[str] = [resume.get("summary", "") or ""]
    for exp in resume.get("experience", []) or []:
        parts.append(f"{exp.get('title') or ''} {exp.get('company') or ''}")
        parts.extend(exp.get("bullets", []) or [])
    for prj in resume.get("projects", []) or []:
        parts.append(prj.get("title") or "")
        parts.extend(prj.get("bullets", []) or [])
    parts.extend(resume.get("skills", []) or [])
    return "\n".join(parts)


def _coverage(needed: List[str], resume_skills: List[str], resume_text: str) -> Tuple[List[str], List[str]]:
    matched, missing = [], []
    rt = " " + resume_text.lower() + " "
    rs_lower = {s.lower() for s in resume_skills}
    for item in needed:
        if not item:
            continue
        key = item.lower()
        if key in rs_lower:
            matched.append(item)
            continue
        if re.search(r"(?<![A-Za-z0-9])" + re.escape(key) + r"(?![A-Za-z0-9])", rt):
            matched.append(item)
            continue
        missing.append(item)
    return matched, missing


def _keyword_density(jd_keywords: List[str], resume: Dict[str, Any]) -> Tuple[float, List[str]]:
    if not jd_keywords:
        return 75.0, []
    text = full_resume_text(resume).lower()
    summary_text = (resume.get("summary") or "").lower()
    recent_bullets_text = ""
    exp = resume.get("experience", []) or []
    if exp:
        recent_bullets_text = " ".join(exp[0].get("bullets", []) or []).lower()

    score = 0.0
    missing = []
    for kw in jd_keywords:
        k = kw.lower()
        if k not in text:
            missing.append(kw)
            continue
        weight = 1.0
        if k in summary_text:
            weight += 0.5
        if k in recent_bullets_text:
            weight += 0.5
        score += weight
    max_score = 2.0 * len(jd_keywords)
    return (score / max_score) * 100.0, missing


def _semantic_similarity(jd: Dict[str, Any], resume: Dict[str, Any]) -> Tuple[float, List[Dict[str, Any]]]:
    jd_units = []
    for r in jd.get("responsibilities", []) or []:
        if r:
            jd_units.append(r)
    for m in jd.get("must_haves", []) or []:
        if m:
            jd_units.append(m)
    if not jd_units:
        return 65.0, []

    resume_units: List[str] = []
    for exp in resume.get("experience", []) or []:
        resume_units.extend(exp.get("bullets", []) or [])
    for prj in resume.get("projects", []) or []:
        resume_units.extend(prj.get("bullets", []) or [])
    if resume.get("summary"):
        resume_units.append(resume["summary"])
    if not resume_units:
        return 30.0, []

    jd_emb = embed(jd_units)
    res_emb = embed(resume_units)
    sims = cosine_matrix(jd_emb, res_emb)  # [|jd|, |res|]
    per_req = []
    best_per_jd = sims.max(axis=1) if sims.size else np.zeros(len(jd_units))
    for unit, best in zip(jd_units, best_per_jd):
        if best >= SEMANTIC_COVER_THRESHOLD:
            tag = "covered"
        elif best >= SEMANTIC_PARTIAL_THRESHOLD:
            tag = "partial"
        else:
            tag = "missing"
        per_req.append({"requirement": unit, "max_similarity": float(best), "status": tag})

    k = max(1, min(10, len(jd_units)))
    top = np.sort(best_per_jd)[-k:]
    # Map cosine [-1, 1] roughly to [0, 100] using observed mid-band.
    mean_top = float(top.mean()) if top.size else 0.0
    score = max(0.0, min(100.0, (mean_top - 0.20) / 0.60 * 100.0))
    return score, per_req


def _experience_relevance(jd: Dict[str, Any], resume: Dict[str, Any]) -> float:
    yoe_min = jd.get("years_experience_min") or 0
    exp = resume.get("experience", []) or []
    if not exp:
        return 25.0 if yoe_min == 0 else 5.0
    # Crude YOE: count distinct date ranges with a year span.
    total_years = 0
    year_pattern = re.compile(r"(\d{4})")
    for e in exp:
        s = year_pattern.search(str(e.get("start") or ""))
        en = year_pattern.search(str(e.get("end") or "")) or year_pattern.search("2026")
        if s and en:
            try:
                total_years += max(0, int(en.group(1)) - int(s.group(1)))
            except Exception:
                pass
    if yoe_min and total_years >= yoe_min:
        base = 90.0
    elif yoe_min:
        base = max(30.0, 90.0 * (total_years / max(1, yoe_min)))
    else:
        base = 70.0 + min(20.0, total_years * 2.0)

    # Title cosine similarity vs JD title (bonus / penalty).
    jd_title = jd.get("title") or ""
    titles = [str(e.get("title") or "") for e in exp][:3]
    if jd_title and titles:
        sims = cosine_matrix(embed([jd_title]), embed(titles))
        bonus = (float(sims.max()) - 0.40) * 25.0
        base += bonus
    return max(0.0, min(100.0, base))


def _education_score(jd: Dict[str, Any], resume: Dict[str, Any]) -> float:
    edu = resume.get("education", []) or []
    if not edu:
        return 50.0
    text = " ".join(e.get("raw") or e.get("summary") or "" for e in edu).lower()
    if any(d in text for d in ("phd", "ph.d", "doctorate")):
        return 95.0
    if any(d in text for d in ("master", "m.s", "msc", "mba")):
        return 90.0
    if any(d in text for d in ("bachelor", "b.s", "b.a", "btech", "b.tech", "be ", "b.e.")):
        return 85.0
    return 70.0


def _formatting_compliance(resume: Dict[str, Any]) -> float:
    fmt = resume.get("source_format")
    score = 80.0
    # Reward parsable formats (PDF with text layer, DOCX, LaTeX).
    if fmt == "pdf":
        score = 90.0
    elif fmt in ("docx", "latex"):
        score = 95.0
    # Penalize missing sections.
    missing_sections = sum(
        1 for k in ("experience", "education", "skills") if not resume.get(k)
    )
    score -= missing_sections * 10
    # Penalize when contact info missing.
    profile = resume.get("profile") or {}
    if not profile.get("email"):
        score -= 5
    if not profile.get("name"):
        score -= 5
    return max(20.0, min(100.0, score))


# --- utils -----------------------------------------------------------------

def _percent(n: int, d: int) -> float:
    if d <= 0:
        return 75.0
    return min(100.0, (n / d) * 100.0)


def _dedupe(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for s in items:
        if not s:
            continue
        k = s.strip().lower()
        if k and k not in seen:
            seen.add(k)
            out.append(s.strip())
    return out

"""Truth-check guardrail.

For every LLM-proposed edit, verify that:
  1. No new numeric values appear that weren't in the original resume.
  2. No new proper-noun entities (companies, products) appear.
  3. No new dates / years.
  4. The new text is not empty or absurdly short.

Edits failing any rule are dropped (returned as "rejected" by the pipeline).
Heuristic-source edits and skills additions are passed through; the planner
already constrains them to evidenced data.
"""
from __future__ import annotations
import re
from typing import Any, Dict, List, Set

NUM_RE = re.compile(r"\b\d[\d,.]*\b")
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
# Conservative proper-noun heuristic: two adjacent capitalized words (e.g. "Acme Cloud").
PROPER_NOUN_RE = re.compile(r"\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)+\b")
COMMON_ALLOWED = {
    "United States", "New York", "San Francisco", "Los Angeles", "United Kingdom",
    "Bachelor of", "Master of", "Doctor of", "Computer Science", "Software Engineer",
    "Machine Learning", "Artificial Intelligence", "Data Science",
}


def filter_safe_edits(original: Dict[str, Any], proposals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    original_text = _flatten(original).lower()
    original_numbers = set(NUM_RE.findall(_flatten(original)))
    original_proper_nouns = set(_proper_nouns(_flatten(original)))

    safe: List[Dict[str, Any]] = []
    for p in proposals:
        # Heuristic/skills sources bypass the guards by design.
        if p.get("source") in ("planner", "heuristic"):
            safe.append(p)
            continue
        if p["target"] == "summary":
            text = p.get("new_text") or ""
        elif p["target"] in ("experience_bullet", "project_bullet"):
            text = p.get("new_text") or ""
        else:
            safe.append(p)
            continue

        rejection = _check_text(
            text=text,
            original_text=original_text,
            original_numbers=original_numbers,
            original_proper_nouns=original_proper_nouns,
        )
        if rejection:
            p["_rejected_reason"] = rejection
            continue
        safe.append(p)
    return safe


def _check_text(text: str, original_text: str, original_numbers: Set[str], original_proper_nouns: Set[str]) -> str:
    if not text or len(text.strip()) < 20:
        return "too short"

    # 1. Numbers.
    for n in NUM_RE.findall(text):
        if n not in original_numbers and not _number_in_original(n, original_text):
            return f"new number not in original: {n!r}"

    # 2. Years.
    for y in YEAR_RE.findall(text):
        if y not in original_text:
            return f"new year not in original: {y!r}"

    # 3. Proper nouns.
    for pn in _proper_nouns(text):
        if pn in COMMON_ALLOWED:
            continue
        if pn in original_proper_nouns:
            continue
        if pn.lower() in original_text:
            continue
        return f"new proper-noun phrase not in original: {pn!r}"

    return ""


def _proper_nouns(text: str) -> List[str]:
    return PROPER_NOUN_RE.findall(text)


def _flatten(resume: Dict[str, Any]) -> str:
    parts: List[str] = [resume.get("summary") or ""]
    for e in resume.get("experience") or []:
        parts.append(e.get("title") or "")
        parts.append(e.get("company") or "")
        parts.append(str(e.get("start") or ""))
        parts.append(str(e.get("end") or ""))
        parts.extend(e.get("bullets") or [])
    for p in resume.get("projects") or []:
        parts.append(p.get("title") or "")
        parts.extend(p.get("bullets") or [])
    parts.extend(resume.get("skills") or [])
    parts.extend(resume.get("skills_extracted") or [])
    for ed in resume.get("education") or []:
        parts.append(ed.get("raw") or ed.get("summary") or "")
    return "\n".join(parts)


def _number_in_original(n: str, original_text: str) -> bool:
    # Allow if the same digit string occurs anywhere in the original (covers reformatting like 2B vs 2,000,000,000).
    return n in original_text

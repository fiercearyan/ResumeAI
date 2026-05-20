"""Turn a flat list of lines into a JSON-Resume-superset structure.

Heuristic-only (no LLM in Phase 1) — fast, deterministic, debuggable.
"""
from __future__ import annotations
import re
from typing import Dict, List, Optional

SECTION_PATTERNS = {
    "summary": re.compile(r"^(summary|profile|objective|about)\b", re.I),
    "experience": re.compile(r"^(experience|work\s+experience|employment|professional\s+experience)\b", re.I),
    "education": re.compile(r"^(education|academic)\b", re.I),
    "skills": re.compile(r"^(skills|technical\s+skills|tech\s+stack|technologies)\b", re.I),
    "projects": re.compile(r"^(projects|personal\s+projects|open\s+source)\b", re.I),
    "certifications": re.compile(r"^(certifications?|licenses?)\b", re.I),
    "awards": re.compile(r"^(awards?|achievements?|honors?)\b", re.I),
}

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(\+?\d[\d\s().-]{7,}\d)")
URL_RE = re.compile(r"https?://[^\s)]+")
LINK_RE = re.compile(r"(linkedin\.com/[\w-]+|github\.com/[\w-]+)", re.I)
DATE_RANGE_RE = re.compile(
    r"((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|present|current)\s*[-–—to]+\s*((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|present|current)",
    re.I,
)
BULLET_LEAD = re.compile(r"^[••\-\*·►●▪◦]\s+")


def normalize(raw: dict) -> dict:
    lines: List[str] = raw.get("lines", [])
    out: Dict = {
        "profile": _extract_profile(lines),
        "summary": "",
        "experience": [],
        "education": [],
        "skills": [],
        "projects": [],
        "certifications": [],
        "awards": [],
        "source_format": raw.get("format"),
    }
    if raw.get("format") == "latex":
        out["latex_source"] = raw.get("raw_source")

    sections = _split_into_sections(lines)
    out["summary"] = "\n".join(sections.get("summary", [])).strip()
    out["experience"] = _parse_experience(sections.get("experience", []))
    out["education"] = _parse_education(sections.get("education", []))
    out["skills"] = _parse_skills(sections.get("skills", []))
    out["projects"] = _parse_experience(sections.get("projects", []))  # same shape
    out["certifications"] = [ln for ln in sections.get("certifications", []) if ln]
    out["awards"] = [ln for ln in sections.get("awards", []) if ln]
    return out


def _extract_profile(lines: List[str]) -> dict:
    profile = {"name": None, "email": None, "phone": None, "links": []}
    # Look at first ~8 lines for header data.
    for ln in lines[:8]:
        if not profile["email"]:
            m = EMAIL_RE.search(ln)
            if m:
                profile["email"] = m.group(0)
        if not profile["phone"]:
            m = PHONE_RE.search(ln)
            if m:
                profile["phone"] = m.group(0).strip()
        for m in URL_RE.finditer(ln):
            profile["links"].append(m.group(0))
        for m in LINK_RE.finditer(ln):
            url = m.group(0)
            if not url.startswith("http"):
                url = "https://" + url
            profile["links"].append(url)
    profile["links"] = list(dict.fromkeys(profile["links"]))
    if lines:
        # Name = first non-contact-info line that looks like a person.
        for ln in lines[:5]:
            if EMAIL_RE.search(ln) or PHONE_RE.search(ln) or URL_RE.search(ln):
                continue
            words = ln.split()
            if 1 < len(words) <= 5 and all(w[:1].isalpha() for w in words):
                profile["name"] = ln
                break
    return profile


def _split_into_sections(lines: List[str]) -> Dict[str, List[str]]:
    sections: Dict[str, List[str]] = {}
    current: Optional[str] = None
    for ln in lines:
        key = _detect_section(ln)
        if key:
            current = key
            sections.setdefault(current, [])
            continue
        if current:
            sections[current].append(ln)
    return sections


def _detect_section(line: str) -> Optional[str]:
    norm = line.strip().rstrip(":").lower()
    # pylatexenc emits "§ Section" for \section{...}. Strip the marker.
    norm = re.sub(r"^[§¶#]+\s*", "", norm)
    if len(norm.split()) > 4:
        return None
    for key, pat in SECTION_PATTERNS.items():
        if pat.match(norm):
            return key
    return None


def _parse_experience(lines: List[str]) -> List[dict]:
    entries: List[dict] = []
    current: Optional[dict] = None
    for ln in lines:
        is_bullet = bool(BULLET_LEAD.match(ln))
        if not is_bullet and DATE_RANGE_RE.search(ln):
            # New role header.
            if current:
                entries.append(current)
            current = _parse_role_header(ln)
            current["bullets"] = []
        elif not is_bullet and current is None:
            # Title line before dates — start a stub.
            current = {"title": ln, "company": None, "start": None, "end": None, "bullets": []}
        elif is_bullet and current is not None:
            current["bullets"].append(BULLET_LEAD.sub("", ln).strip())
        elif current is not None:
            # Continuation line — append to last bullet if any, else as new bullet.
            if current["bullets"]:
                current["bullets"][-1] += " " + ln
            else:
                current["bullets"].append(ln)
    if current:
        entries.append(current)
    return entries


def _parse_role_header(line: str) -> dict:
    m = DATE_RANGE_RE.search(line)
    start, end = (m.group(1), m.group(2)) if m else (None, None)
    pre_date = line[: m.start()].strip() if m else line
    parts = re.split(r"\s+[-–—|@]\s+|,\s+", pre_date, maxsplit=1)
    title = parts[0].strip() if parts else line
    company = parts[1].strip() if len(parts) > 1 else None
    return {"title": title or None, "company": company, "start": start, "end": end}


def _parse_education(lines: List[str]) -> List[dict]:
    entries = []
    for ln in lines:
        if not ln:
            continue
        m = DATE_RANGE_RE.search(ln)
        end = m.group(2) if m else None
        clean = DATE_RANGE_RE.sub("", ln).strip(" ,;-")
        entries.append({"raw": ln, "summary": clean, "end": end})
    return entries


def _parse_skills(lines: List[str]) -> List[str]:
    skills: List[str] = []
    for ln in lines:
        parts = re.split(r"[,•;|/]+|\s{2,}", ln)
        for p in parts:
            p = p.strip(" :")
            if p and 1 < len(p) <= 40:
                skills.append(p)
    # Dedupe preserving order.
    seen = set()
    out = []
    for s in skills:
        k = s.lower()
        if k not in seen:
            seen.add(k)
            out.append(s)
    return out

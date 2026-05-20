"""LaTeX regeneration without parsing/round-tripping the AST.

Strategy: walk the original .tex source string and replace bullet text
inside known LaTeX list commands (\item, \resumeItem, \cvitem, etc.). The
template envelope is preserved exactly — we only touch the text payload.

This avoids re-emitting the whole document (which would risk losing custom
preamble / spacing / commands). Anything we don't understand is left alone.
"""
from __future__ import annotations
import re
from typing import Any, Dict, List

LATEX_SPECIALS = {
    "\\": r"\textbackslash{}",
    "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
    "_": r"\_", "{": r"\{", "}": r"\}",
    "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
}


def latex_escape(text: str) -> str:
    out = []
    for ch in text:
        out.append(LATEX_SPECIALS.get(ch, ch))
    return "".join(out)


def regenerate_latex(original_source: str, original_resume: Dict[str, Any], new_resume: Dict[str, Any]) -> str:
    if not original_source:
        return ""

    # Build a map: original-bullet-text → new-bullet-text (only where changed).
    replacements: List[tuple[str, str]] = []
    for orig_exp, new_exp in zip(original_resume.get("experience") or [], new_resume.get("experience") or []):
        for orig_b, new_b in zip(orig_exp.get("bullets") or [], new_exp.get("bullets") or []):
            if orig_b.strip() != new_b.strip():
                replacements.append((orig_b.strip(), new_b.strip()))
    for orig_p, new_p in zip(original_resume.get("projects") or [], new_resume.get("projects") or []):
        for orig_b, new_b in zip(orig_p.get("bullets") or [], new_p.get("bullets") or []):
            if orig_b.strip() != new_b.strip():
                replacements.append((orig_b.strip(), new_b.strip()))

    # Apply replacements directly on the source string. For each pair, search
    # for the original bullet (allowing for escaped LaTeX specials) and replace.
    source = original_source
    for orig, new in replacements:
        # The bullet in the .tex may have backslash-escapes (e.g. 38\%). Build
        # a permissive search pattern that ignores backslash-escapes.
        pattern = _build_search_pattern(orig)
        replacement = latex_escape(new)
        try:
            source = re.sub(pattern, lambda m: replacement, source, count=1)
        except re.error:
            continue

    # Summary: also try to replace it if it appears verbatim somewhere.
    old_summary = (original_resume.get("summary") or "").strip()
    new_summary = (new_resume.get("summary") or "").strip()
    if old_summary and new_summary and old_summary != new_summary:
        pattern = _build_search_pattern(old_summary)
        try:
            source = re.sub(pattern, lambda m: latex_escape(new_summary), source, count=1)
        except re.error:
            pass

    # Skills: rewrite the first \section*{Skills} … paragraph if we surfaced new skills.
    orig_skills = [s.strip() for s in (original_resume.get("skills") or [])]
    new_skills = [s.strip() for s in (new_resume.get("skills") or [])]
    if new_skills and new_skills != orig_skills:
        source = _patch_skills_section(source, new_skills)

    return source


def _build_search_pattern(text: str) -> str:
    # Treat any whitespace as flexible, ignore single backslash escapes of LaTeX specials.
    pieces = []
    for ch in text:
        if ch.isspace():
            pieces.append(r"\s+")
            continue
        if ch in {"&", "%", "$", "#", "_"}:
            pieces.append(r"\\?" + re.escape(ch))
            continue
        pieces.append(re.escape(ch))
    return "".join(pieces)


def _patch_skills_section(source: str, skills: List[str]) -> str:
    skill_line = ", ".join(latex_escape(s) for s in skills) + "."
    # Find \section*{Skills} (case-insensitive) then replace the immediate paragraph.
    pattern = re.compile(
        r"(\\section\*?\s*\{[^}]*Skills[^}]*\})(.*?)(\\section|\\end\{document\})",
        re.IGNORECASE | re.DOTALL,
    )
    return pattern.sub(lambda m: f"{m.group(1)}\n{skill_line}\n\n{m.group(3)}", source, count=1)

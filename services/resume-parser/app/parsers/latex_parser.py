from pylatexenc.latex2text import LatexNodes2Text


def parse_latex(source: str) -> dict:
    """Convert LaTeX to plaintext for normalization.

    The full AST is also returned (kept for Phase 2 patcher work).
    """
    converter = LatexNodes2Text(strict_latex_spaces=False)
    try:
        text = converter.latex_to_text(source)
    except Exception:
        # Fallback: strip commands very crudely.
        import re
        text = re.sub(r"\\[A-Za-z]+\{([^}]*)\}", r"\1", source)
        text = re.sub(r"\\[A-Za-z]+", "", text)

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return {"lines": lines, "raw_source": source, "format": "latex"}

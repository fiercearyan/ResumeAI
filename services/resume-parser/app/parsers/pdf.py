from io import BytesIO
from typing import List
import pdfplumber
import fitz  # PyMuPDF


def parse_pdf(data: bytes) -> dict:
    """Extract a flat list of text lines + per-page metrics from a PDF.

    Returns a raw structure {lines: [...], pages: int, has_text_layer: bool}.
    Section detection is left to the normalizer.
    """
    lines: List[str] = []
    pages = 0
    text_chars = 0

    # pdfplumber for ordered text lines.
    with pdfplumber.open(BytesIO(data)) as pdf:
        pages = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text() or ""
            text_chars += len(text)
            for ln in text.split("\n"):
                ln = ln.strip()
                if ln:
                    lines.append(ln)

    has_text_layer = text_chars > 50

    # PyMuPDF fallback for fully-scanned PDFs (no text layer at all).
    if not has_text_layer:
        doc = fitz.open(stream=data, filetype="pdf")
        for page in doc:
            text = page.get_text("text")
            for ln in text.split("\n"):
                ln = ln.strip()
                if ln:
                    lines.append(ln)
        doc.close()

    return {
        "lines": lines,
        "pages": pages,
        "has_text_layer": has_text_layer,
        "format": "pdf",
    }

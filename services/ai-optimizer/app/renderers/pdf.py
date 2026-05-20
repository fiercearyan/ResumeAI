"""PDF rendering via WeasyPrint.

The resume JSON is poured into a clean Jinja2 HTML template and rendered as
A4 PDF. Returns base64 bytes so the orchestrator can store it in MinIO.
"""
from __future__ import annotations
import base64
import html
from io import BytesIO
from typing import Any, Dict
from jinja2 import Template
from weasyprint import HTML, CSS

TEMPLATE = Template(
    """<!doctype html>
<html><head><meta charset="utf-8"><title>{{ name|e }} — Resume</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; color: #0b1320; font-size: 10.5pt; line-height: 1.35; }
  h1 { font-size: 18pt; margin: 0 0 2pt 0; letter-spacing: 0.2px; }
  h2 { font-size: 11pt; margin: 16pt 0 4pt 0; text-transform: uppercase; letter-spacing: 1px; color: #1f3a8a; border-bottom: 1px solid #1f3a8a33; padding-bottom: 2pt; }
  .contact { font-size: 9.5pt; color: #555; margin-bottom: 4pt; }
  .role-header { display: flex; justify-content: space-between; font-weight: 600; margin-top: 6pt; }
  .role-dates { color: #555; font-weight: 400; font-size: 9.5pt; }
  ul { margin: 3pt 0 4pt 18pt; padding: 0; }
  li { margin: 2pt 0; }
  .skills { display: flex; flex-wrap: wrap; gap: 4pt; }
  .skills span { background: #eef2ff; color: #1f3a8a; padding: 1pt 6pt; border-radius: 10px; font-size: 9pt; }
  .summary { margin-bottom: 4pt; }
  .education-item { margin-top: 2pt; }
</style></head>
<body>
  <h1>{{ name|e or '—' }}</h1>
  <div class="contact">
    {% if email %}{{ email|e }}{% endif %}
    {% if phone %} · {{ phone|e }}{% endif %}
    {% for l in links %} · <a href="{{ l|e }}">{{ l|e }}</a>{% endfor %}
  </div>

  {% if summary %}
  <h2>Summary</h2>
  <p class="summary">{{ summary|e }}</p>
  {% endif %}

  {% if experience %}
  <h2>Experience</h2>
  {% for e in experience %}
    <div class="role-header">
      <span>{{ (e.title or '')|e }}{% if e.company %} · {{ e.company|e }}{% endif %}</span>
      <span class="role-dates">{{ (e.start or '')|e }}{% if e.end %} – {{ e.end|e }}{% endif %}</span>
    </div>
    <ul>{% for b in (e.bullets or []) %}<li>{{ b|e }}</li>{% endfor %}</ul>
  {% endfor %}
  {% endif %}

  {% if skills %}
  <h2>Skills</h2>
  <div class="skills">{% for s in skills %}<span>{{ s|e }}</span>{% endfor %}</div>
  {% endif %}

  {% if projects %}
  <h2>Projects</h2>
  {% for p in projects %}
    <div class="role-header"><span>{{ (p.title or '')|e }}</span></div>
    <ul>{% for b in (p.bullets or []) %}<li>{{ b|e }}</li>{% endfor %}</ul>
  {% endfor %}
  {% endif %}

  {% if education %}
  <h2>Education</h2>
  {% for ed in education %}
    <div class="education-item">{{ (ed.raw or ed.summary or '')|e }}</div>
  {% endfor %}
  {% endif %}
</body></html>"""
)


def render_pdf(resume: Dict[str, Any]) -> str:
    profile = resume.get("profile") or {}
    html_str = TEMPLATE.render(
        name=profile.get("name") or "",
        email=profile.get("email") or "",
        phone=profile.get("phone") or "",
        links=profile.get("links") or [],
        summary=resume.get("summary") or "",
        experience=resume.get("experience") or [],
        skills=resume.get("skills") or [],
        projects=resume.get("projects") or [],
        education=resume.get("education") or [],
    )
    buf = BytesIO()
    HTML(string=html_str).write_pdf(buf)
    return base64.b64encode(buf.getvalue()).decode("ascii")

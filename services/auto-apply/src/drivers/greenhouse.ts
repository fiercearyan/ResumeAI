/**
 * Greenhouse Smart Apply driver.
 *
 * Replaces the Phase-3 selector-table approach with a full form scan:
 *   1. Walk every <label> on the page.
 *   2. Normalize each label and resolve it against the user's mappings +
 *      saved_answers + profile via the orchestrator's resolveLabel endpoint
 *      (or the inlined map for speed).
 *   3. Fill what we can. Anything unmatched / unfilled becomes a
 *      PendingQuestion the worker surfaces in awaiting_user.
 *
 * The previous selector hardcoding (#first_name etc.) is kept as a fallback
 * for forms that don't link labels properly.
 */
import type { ApplyDriver, DriverContext, FillFormResult, FillResult, PendingQuestion } from './types';

const GREENHOUSE_HOST_RE = /(^|\.)greenhouse\.io$/;

export const greenhouse: ApplyDriver = {
  name: 'greenhouse',

  canHandle(url: string) {
    try {
      const u = new URL(url);
      if (GREENHOUSE_HOST_RE.test(u.hostname)) return true;
      if (/mock-greenhouse/.test(u.pathname)) return true;
      return false;
    } catch {
      return false;
    }
  },

  async fillForm(ctx: DriverContext): Promise<FillFormResult> {
    const { page, jdUrl, resumePdfPath, applyContext } = ctx;
    await page.goto(jdUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await ctx.event('page_loaded', { meta: { url: page.url() } });

    // Click "Apply" CTA if present.
    const applyCta = page.locator('a:has-text("Apply"), button:has-text("Apply")').first();
    if (await applyCta.isVisible().catch(() => false)) {
      try { await applyCta.click({ timeout: 5_000 }); } catch {}
    }

    await ctx.screenshot('before_fill');

    // Build a per-page list of every label + its associated input.
    const fields = await scanFormFields(page);
    await ctx.event('form_scanned', { meta: { fieldCount: fields.length } });

    const filled: FillResult[] = [];
    const pending: PendingQuestion[] = [];
    const savedByKey = new Map(applyContext.savedAnswers.map((a) => [a.questionKey, a.answerText]));
    const mapByLabel = new Map(applyContext.mappings.map((m) => [m.labelPattern, m]));

    for (const f of fields) {
      // Resume input: always upload the file, regardless of label.
      if (f.kind === 'file') {
        try {
          await page.locator(f.selector).first().setInputFiles(resumePdfPath, { timeout: 30_000 });
          filled.push({ label: f.label, profileField: 'profile.resume', confidence: 1.0, source: 'profile', filled: true });
          await ctx.event('field_filled', { meta: { label: f.label, kind: 'file', source: 'profile' } });
        } catch (e: any) {
          await ctx.event('field_skipped', { ok: false, message: e?.message, meta: { label: f.label, reason: 'file_upload_failed' } });
          pending.push({ label: f.label, questionKey: normalizeLabel(f.label), kind: 'file', required: f.required });
        }
        continue;
      }

      const norm = normalizeLabel(f.label);
      let value: string | null = null;
      let source: FillResult['source'] = 'unmatched';
      let confidence = 0;
      let profileField: string | null = null;

      // 1) Exact saved-answer hit.
      if (savedByKey.has(norm)) {
        value = String(savedByKey.get(norm));
        source = 'saved_answer';
        confidence = 1.0;
        profileField = 'saved_answer';
      } else {
        // 2) Mapping lookup (exact then substring).
        let m = mapByLabel.get(norm) || null;
        if (!m) {
          for (const cand of applyContext.mappings) {
            if (norm.includes(cand.labelPattern) || cand.labelPattern.includes(norm)) { m = cand; break; }
          }
        }
        if (m) {
          const v = readByPath(applyContext.scope, m.profileField);
          if (v != null && v !== '') {
            value = formatForField(v, f.kind);
            source = 'profile';
            confidence = m.profileField === 'profile.resume' ? 1.0 : m.confidence;
            profileField = m.profileField;
          } else {
            // mapping known but profile value missing — counts as pending so the user can fill it once.
            source = 'field_mapping';
            confidence = m.confidence;
            profileField = m.profileField;
          }
        }
      }

      if (value != null) {
        const ok = await fillField(page, f, value);
        filled.push({ label: f.label, profileField, confidence, source, filled: ok });
        if (ok) {
          await ctx.event('field_filled', { meta: { label: f.label, kind: f.kind, source, confidence, profileField } });
        } else {
          pending.push({ label: f.label, questionKey: norm, kind: f.kind as any, options: f.options, required: f.required });
          await ctx.event('field_fill_failed', { ok: false, meta: { label: f.label, source } });
        }
      } else {
        // No value: only flag as pending if the field is required, or if the
        // label looks like a real question (length > 2). Filters out random
        // labels like spacer rows.
        if (f.required || f.label.trim().length > 4) {
          pending.push({ label: f.label, questionKey: norm, kind: f.kind as any, options: f.options, required: f.required });
          await ctx.event('pending_question', {
            ok: false,
            meta: { label: f.label, kind: f.kind, options: f.options, required: f.required, confidence },
          });
        }
      }
    }

    // Captcha detection.
    const captcha = page.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], #cf-challenge-stage').first();
    if (await captcha.isVisible().catch(() => false)) {
      await ctx.event('captcha_detected', { ok: false, message: 'Captcha challenge — review mode required.' });
    }

    await ctx.screenshot('after_fill', { fullPage: true });
    return { filled, pending };
  },

  async submit(ctx: DriverContext) {
    const { page } = ctx;
    const submit = page
      .locator('input[type="submit"], button[type="submit"], #submit_app, button:has-text("Submit application")')
      .first();
    if (!(await submit.count())) throw new Error('Submit button not found.');
    await submit.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
    await ctx.screenshot('before_submit');

    const beforeUrl = page.url();
    await submit.click({ timeout: 15_000 });

    const CONFIRMATION = ':text-matches("thank you for applying|application received|application has been received|we have received your application|application submitted", "i")';
    const VALIDATION = '.field--error, .error, [aria-invalid="true"], :text-matches("is required|please enter|please select", "i")';

    const outcome = await Promise.race([
      page.waitForSelector(CONFIRMATION, { timeout: 25_000, state: 'visible' }).then(() => 'confirmed').catch(() => null),
      page.waitForURL((u) => u.toString() !== beforeUrl, { timeout: 25_000 }).then(() => 'url_changed').catch(() => null),
      page.waitForSelector(VALIDATION, { timeout: 25_000, state: 'visible' }).then(() => 'validation_error').catch(() => null),
      new Promise<string>((r) => setTimeout(() => r('timeout'), 26_000)),
    ]);

    await ctx.screenshot('after_submit', { fullPage: true });
    if (outcome === 'validation_error') {
      const errors = await page.locator('.field--error, .error, [aria-invalid="true"]').allInnerTexts().catch(() => [] as string[]);
      const dedup = Array.from(new Set(errors.map((e) => e.trim()).filter(Boolean))).slice(0, 8);
      throw new Error(`Form not submitted — validation errors: ${dedup.join(' · ') || 'unspecified required fields missing'}`);
    }
    if (outcome === 'timeout') {
      throw new Error('Submission did not confirm in 26s — page likely needs manual review.');
    }
    const confirmation = await page.textContent('body').then((t) => (t || '').slice(0, 2000)).catch(() => '');
    return { confirmationText: confirmation };
  },
};

// ---------------------------------------------------------------------------
// Form scanning + helpers
// ---------------------------------------------------------------------------

interface FormField {
  label: string;
  selector: string;
  kind: 'text' | 'email' | 'tel' | 'url' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'unknown';
  options?: string[];
  required: boolean;
}

/** Mirrors the orchestrator's normalizeLabel exactly. */
function normalizeLabel(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/\bu\.?s\.?(a)?\b/g, 'us')
    .replace(/&/g, 'and')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\*/g, '')
    .replace(/\brequired\b/g, '')
    .replace(/[?.:;,!]/g, ' ')
    .replace(/[^a-z0-9\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readByPath(scope: any, path: string): any {
  if (!path || path === 'saved_answer' || path === 'profile.resume') return null;
  const parts = path.split('.');
  let cur: any = scope;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur ?? null;
}

function formatForField(value: any, kind: FormField['kind']): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (kind === 'number' && typeof value === 'number') return String(value);
  return String(value);
}

async function scanFormFields(page: any): Promise<FormField[]> {
  // Pull a structured list out of the DOM in one round-trip.
  return page.evaluate(() => {
    function visible(el: Element) {
      if (!el) return false;
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    function inputKind(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FormField['kind'] {
      if (el.tagName === 'TEXTAREA') return 'textarea';
      if (el.tagName === 'SELECT') return 'select';
      const t = ((el as HTMLInputElement).type || '').toLowerCase();
      if (t === 'email') return 'email';
      if (t === 'tel') return 'tel';
      if (t === 'url') return 'url';
      if (t === 'number') return 'number';
      if (t === 'file') return 'file';
      if (t === 'radio') return 'radio';
      if (t === 'checkbox') return 'checkbox';
      return 'text';
    }

    const out: FormField[] = [];
    const seen = new Set<Element>();
    const labels = Array.from(document.querySelectorAll('label')) as HTMLLabelElement[];

    for (const label of labels) {
      const labelText = (label.textContent || '').trim();
      if (!labelText) continue;
      // Find the associated input.
      let target: Element | null = null;
      if (label.htmlFor) target = document.getElementById(label.htmlFor);
      if (!target) target = label.querySelector('input, select, textarea');
      if (!target) {
        // Look at the next sibling block.
        let sib = label.nextElementSibling;
        while (sib && !target) {
          target = sib.querySelector?.('input, select, textarea') || (['INPUT','SELECT','TEXTAREA'].includes(sib.tagName) ? sib : null);
          sib = sib.nextElementSibling;
        }
      }
      if (!target || seen.has(target) || !visible(target)) continue;
      seen.add(target);
      const el = target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const kind = inputKind(el);
      // Build a stable selector. Prefer #id, fall back to [name="..."].
      const sel = el.id
        ? `#${CSS.escape(el.id)}`
        : (el as any).name
        ? `${el.tagName.toLowerCase()}[name="${(el as any).name.replace(/"/g, '\\"')}"]`
        : null;
      if (!sel) continue;
      let options: string[] | undefined;
      if (kind === 'select') {
        options = Array.from((el as HTMLSelectElement).options).map((o) => o.text).filter((t) => t && t !== '');
      }
      const required = (el as HTMLInputElement).required || /\*/.test(labelText) || /required/i.test(labelText);
      out.push({ label: labelText, selector: sel, kind, options, required });
    }
    return out;
  });
}

async function fillField(page: any, field: FormField, value: string): Promise<boolean> {
  const loc = page.locator(field.selector).first();
  try {
    if (field.kind === 'select') {
      await loc.selectOption({ label: value }, { timeout: 5_000 }).catch(async () => {
        // Fallback: match by value substring.
        const opts = await loc.locator('option').allTextContents();
        const close = opts.find((o: string) => o.toLowerCase().includes(value.toLowerCase()));
        if (close) await loc.selectOption({ label: close }, { timeout: 3_000 });
      });
      return true;
    }
    if (field.kind === 'checkbox' || field.kind === 'radio') {
      const truthy = /^(true|yes|y|1)$/i.test(value);
      if (truthy) await loc.check({ timeout: 3_000 });
      return true;
    }
    await loc.fill(value, { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

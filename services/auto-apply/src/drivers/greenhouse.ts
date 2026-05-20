/**
 * Greenhouse Boards driver.
 *
 * Targets `boards.greenhouse.io/<company>/jobs/<id>` and the embedded apply
 * iframe `boards.greenhouse.io/embed/job_app?for=<company>&token=<id>`.
 * Greenhouse forms are reasonably standardized:
 *   - #first_name, #last_name, #email, #phone
 *   - #resume input[type=file]
 *   - #candidate-confirm or `[id^=submit_app]`
 *
 * We treat each selector as best-effort; missing fields are skipped and an
 * apply_event is recorded so the user sees what was filled.
 */
import type { ApplyDriver, DriverContext } from './types';

const GREENHOUSE_HOST_RE = /(^|\.)greenhouse\.io$/;

export const greenhouse: ApplyDriver = {
  name: 'greenhouse',

  canHandle(url: string) {
    try {
      const u = new URL(url);
      if (GREENHOUSE_HOST_RE.test(u.hostname)) return true;
      // Test-mode fixture: any URL whose path includes "mock-greenhouse".
      // Used by the smoke test against samples/mock-greenhouse.html.
      if (/mock-greenhouse/.test(u.pathname)) return true;
      return false;
    } catch {
      return false;
    }
  },

  async fillForm(ctx: DriverContext) {
    const { page, jdUrl, profile, resumePdfPath } = ctx;

    await page.goto(jdUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await ctx.event('page_loaded', { meta: { url: page.url() } });

    // Some Greenhouse postings embed the apply form in an iframe; for the
    // most common board.greenhouse.io flow the form is on the same page.
    const formRoot = page;

    // Click "Apply" if a CTA button is rendered above the form.
    const applyCta = formRoot.locator('a:has-text("Apply"), button:has-text("Apply")').first();
    if (await applyCta.isVisible().catch(() => false)) {
      try {
        await applyCta.click({ timeout: 5_000 });
      } catch {
        /* may be a no-op if the form is already inline */
      }
    }

    await ctx.screenshot('before_fill');

    await fillIfPresent(formRoot, '#first_name', profile.firstName);
    await fillIfPresent(formRoot, '#last_name', profile.lastName);
    await fillIfPresent(formRoot, '#email', profile.email);
    await fillIfPresent(formRoot, '#phone', profile.phone);
    // Some templates use named fields.
    await fillIfPresent(formRoot, 'input[name="job_application[answers_attributes][0][text_value]"]', profile.linkedinUrl);

    await fillByLabel(formRoot, /linkedin/i, profile.linkedinUrl);
    await fillByLabel(formRoot, /github/i, profile.githubUrl);
    await fillByLabel(formRoot, /portfolio|website/i, profile.portfolioUrl);

    // Location/City: Greenhouse's standard "Location (City)" field uses a
    // Google-Places-autocomplete input. Type the value and pick the first option.
    await fillLocation(formRoot, profile.city);

    // Resume upload — real Greenhouse postings often use a hidden file input
    // under a styled "Attach" button. Match all common shapes.
    const fileInput = formRoot.locator(
      'input[type="file"]#resume, #resume_fieldset input[type="file"], input[type="file"][name*="resume" i], input[type="file"]',
    ).first();
    if (await fileInput.count()) {
      try {
        await fileInput.setInputFiles(resumePdfPath, { timeout: 30_000 });
        await ctx.event('resume_uploaded', { meta: { path: resumePdfPath } });
      } catch (e: any) {
        await ctx.event('resume_upload_failed', { ok: false, message: e?.message });
      }
    } else {
      await ctx.event('resume_input_missing', { ok: false, message: 'No <input type=file> found for resume' });
    }

    // Captcha detection.
    const captcha = formRoot.locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], #cf-challenge-stage').first();
    if (await captcha.isVisible().catch(() => false)) {
      await ctx.event('captcha_detected', { ok: false, message: 'Captcha challenge — review mode required.' });
    }

    // Detect required fields the driver cannot autofill (Education dropdowns,
    // custom select questions, etc.). Surface them so the user knows manual
    // intervention is needed BEFORE clicking Approve & submit.
    const unfilled = await listUnfilledRequired(formRoot);
    if (unfilled.length) {
      await ctx.event('unfilled_required_fields', {
        ok: false,
        message:
          `${unfilled.length} required field${unfilled.length === 1 ? '' : 's'} not autofilled: ${unfilled.slice(0, 8).join(' · ')}` +
          ` — fill them manually before approving submit, or this application will fail validation.`,
        meta: { fields: unfilled },
      });
    }

    await ctx.screenshot('after_fill', { fullPage: true });
  },

  async submit(ctx: DriverContext) {
    const { page } = ctx;
    const submit = page
      .locator('input[type="submit"], button[type="submit"], #submit_app, button:has-text("Submit application")')
      .first();
    if (!(await submit.count())) {
      throw new Error('Submit button not found.');
    }
    await submit.scrollIntoViewIfNeeded({ timeout: 5_000 }).catch(() => {});
    await ctx.screenshot('before_submit');

    const beforeUrl = page.url();
    await submit.click({ timeout: 15_000 });

    // Race four outcomes: confirmation text, URL change, validation error, or timeout.
    const CONFIRMATION_SELECTOR = ':text-matches("thank you for applying|application received|application has been received|we have received your application|application submitted", "i")';
    const VALIDATION_SELECTOR = '.field--error, .error, [aria-invalid="true"], :text-matches("is required|please enter|please select", "i")';

    const outcome = await Promise.race([
      page.waitForSelector(CONFIRMATION_SELECTOR, { timeout: 25_000, state: 'visible' }).then(() => 'confirmed').catch(() => null),
      page.waitForURL((u) => u.toString() !== beforeUrl, { timeout: 25_000 }).then(() => 'url_changed').catch(() => null),
      page.waitForSelector(VALIDATION_SELECTOR, { timeout: 25_000, state: 'visible' }).then(() => 'validation_error').catch(() => null),
      new Promise<string>((r) => setTimeout(() => r('timeout'), 26_000)),
    ]);

    await ctx.screenshot('after_submit', { fullPage: true });

    if (outcome === 'validation_error') {
      // Collect visible validation messages to surface to the user.
      const errors = await page
        .locator('.field--error, .error, [aria-invalid="true"]')
        .allInnerTexts()
        .catch(() => [] as string[]);
      const dedup = Array.from(new Set(errors.map((e) => e.trim()).filter(Boolean))).slice(0, 8);
      throw new Error(
        `Form not submitted — validation errors: ${dedup.join(' · ') || 'unspecified required fields missing'}`,
      );
    }
    if (outcome === 'timeout') {
      throw new Error('Submission did not confirm in 26s — page likely needs manual review.');
    }

    const confirmation = await page.textContent('body').then((t) => (t || '').slice(0, 2000)).catch(() => '');
    return { confirmationText: confirmation };
  },
};

async function fillIfPresent(page: any, selector: string, value?: string | null) {
  if (!value) return;
  const el = page.locator(selector).first();
  if (!(await el.count())) return;
  try {
    await el.fill(value, { timeout: 5_000 });
  } catch {
    /* ignore */
  }
}

async function fillByLabel(page: any, labelMatch: RegExp, value?: string | null) {
  if (!value) return;
  try {
    const labels = page.locator('label');
    const count = await labels.count();
    for (let i = 0; i < count; i++) {
      const text = (await labels.nth(i).innerText().catch(() => '')) || '';
      if (!labelMatch.test(text)) continue;
      const forAttr = await labels.nth(i).getAttribute('for');
      if (forAttr) {
        const target = page.locator(`#${forAttr}`).first();
        if (await target.count()) {
          await target.fill(value, { timeout: 3_000 }).catch(() => {});
          return;
        }
      }
    }
  } catch {
    /* ignore */
  }
}

async function fillLocation(page: any, city?: string | null) {
  if (!city) return;
  // Greenhouse's "Location (City)" is a Google-Places autocomplete.
  // Find the input via label text → type → wait for the dropdown → press Enter.
  try {
    const labels = page.locator('label');
    const count = await labels.count();
    for (let i = 0; i < count; i++) {
      const text = (await labels.nth(i).innerText().catch(() => '')) || '';
      if (!/location|city/i.test(text)) continue;
      const forAttr = await labels.nth(i).getAttribute('for');
      if (!forAttr) continue;
      const input = page.locator(`#${forAttr}`).first();
      if (!(await input.count())) continue;
      await input.click({ timeout: 3_000 }).catch(() => {});
      await input.fill('', { timeout: 2_000 }).catch(() => {});
      await input.type(city, { delay: 80 });
      // Give Places time to return predictions, then arrow-down + Enter to pick first.
      await page.waitForTimeout(1500);
      await page.keyboard.press('ArrowDown').catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      return;
    }
  } catch {
    /* ignore */
  }
}

async function listUnfilledRequired(page: any): Promise<string[]> {
  // A required text/select input is considered "unfilled" if it has the
  // `required` attribute (or aria-required) AND its value is empty.
  try {
    return await page.evaluate(() => {
      const out: string[] = [];
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea',
      ));
      for (const el of inputs) {
        if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button') continue;
        const req = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
        if (!req) continue;
        const v = (el as any).value;
        if (v && String(v).trim().length > 0) continue;
        // Label lookup.
        const id = el.id;
        let label = '';
        if (id) {
          const l = document.querySelector(`label[for="${id}"]`);
          if (l) label = (l.textContent || '').trim();
        }
        if (!label) {
          const parentLabel = el.closest('label');
          if (parentLabel) label = (parentLabel.textContent || '').trim();
        }
        if (!label) label = el.getAttribute('name') || el.getAttribute('id') || el.tagName.toLowerCase();
        out.push(label.replace(/\s*\*\s*$/, '').replace(/\s+/g, ' ').slice(0, 60));
      }
      // Dedupe while preserving order.
      return Array.from(new Set(out));
    });
  } catch {
    return [];
  }
}

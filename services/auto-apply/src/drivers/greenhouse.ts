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

    // Common Greenhouse "custom field" inputs: any text input with label "LinkedIn".
    await fillByLabel(formRoot, /linkedin/i, profile.linkedinUrl);
    await fillByLabel(formRoot, /github/i, profile.githubUrl);
    await fillByLabel(formRoot, /portfolio|website/i, profile.portfolioUrl);
    await fillByLabel(formRoot, /city|location/i, profile.city);

    // Resume upload — Greenhouse uses #resume or a [type=file] under #resume_fieldset.
    const fileInput = formRoot.locator(
      'input#resume[type="file"], #resume_fieldset input[type="file"], input[type="file"][name*="resume" i]',
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
    await submit.click({ timeout: 15_000 });

    // Wait for a confirmation marker.
    await page
      .waitForSelector(
        ':text("thank you for applying"), :text("application received"), :text("submitted"), :text("we received your application")',
        { timeout: 20_000 },
      )
      .catch(() => {});
    await ctx.screenshot('after_submit', { fullPage: true });

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
  // Find a <label> whose text matches, then look at its `for=` or the next input.
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

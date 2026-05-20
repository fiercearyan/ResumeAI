/**
 * Background worker: blocks on a Redis list (BLPOP). For each application id,
 * fetches state from Postgres, drives Playwright, persists per-step events
 * and screenshots, and transitions the application's status through the
 * state machine: queued → in_progress → awaiting_user → submitted | failed.
 *
 * Resume mode: when an application is in `awaiting_user` and the user clicks
 * "Approve & submit", the orchestrator pushes the id back to the queue with
 * a `resume:` prefix. We pick it up here and only run the submit phase.
 */
import Redis from 'ioredis';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium } from 'playwright';
import { config } from './config';
import { prisma, recordEvent, setStatus } from './db';
import { putScreenshot, getResume } from './s3';
import { loadParsedResume } from './mongo';
import { pickDriver } from './drivers/registry';
import type { DriverContext, UserProfile } from './drivers/types';

const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const producer = new Redis(config.redisUrl);

const RESUME_PREFIX = 'resume:';

export async function enqueueApplication(applicationId: string) {
  await producer.rpush(config.queueKey, applicationId);
}

export async function resumeApplication(applicationId: string) {
  await producer.rpush(config.queueKey, RESUME_PREFIX + applicationId);
}

export async function runWorker() {
  console.log('[auto-apply] worker started; queue=', config.queueKey);
  while (true) {
    try {
      const item = await redis.blpop(config.queueKey, 0);
      if (!item) continue;
      const [, value] = item;
      const isResume = value.startsWith(RESUME_PREFIX);
      const applicationId = isResume ? value.slice(RESUME_PREFIX.length) : value;
      await processOne(applicationId, isResume).catch(async (e) => {
        console.error('[auto-apply] application failed', applicationId, e);
        await recordEvent(applicationId, 'crash', { ok: false, message: e?.message || String(e) }).catch(() => {});
        await setStatus(applicationId, 'failed', { lastError: e?.message || String(e) }).catch(() => {});
      });
    } catch (e) {
      console.error('[auto-apply] worker loop iteration error', e);
      await new Promise((r) => setTimeout(r, config.pollIntervalMs));
    }
  }
}

async function processOne(applicationId: string, isResume: boolean) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      jd: true,
      resumeVersion: { include: { resume: true } },
    },
  });
  if (!app) {
    console.warn('[auto-apply] application not found', applicationId);
    return;
  }
  const userPrefs = await prisma.userPreference.findUnique({ where: { userId: app.userId } });
  const userRow = await prisma.user.findUnique({ where: { id: app.userId } });
  if (!userRow) throw new Error('User not found');

  const profile: UserProfile = {
    firstName: userPrefs?.firstName ?? userRow.fullName?.split(' ')[0] ?? null,
    lastName: userPrefs?.lastName ?? userRow.fullName?.split(' ').slice(1).join(' ') ?? null,
    email: userRow.email,
    phone: userPrefs?.phone ?? null,
    city: userPrefs?.city ?? null,
    countryCode: userPrefs?.countryCode ?? null,
    workAuth: userPrefs?.workAuth ?? null,
    needsSponsorship: userPrefs?.needsSponsorship ?? null,
    linkedinUrl: userPrefs?.linkedinUrl ?? null,
    githubUrl: userPrefs?.githubUrl ?? null,
    portfolioUrl: userPrefs?.portfolioUrl ?? null,
  };

  const jdUrl = app.jd.sourceUrl;
  if (!jdUrl) {
    await setStatus(applicationId, 'failed', { lastError: 'JD has no source_url; URL ingestion required for auto-apply.' });
    await recordEvent(applicationId, 'no_jd_url', { ok: false });
    return;
  }
  const driver = pickDriver(jdUrl);
  if (!driver) {
    await setStatus(applicationId, 'failed', { lastError: `No driver matches URL ${jdUrl}` });
    await recordEvent(applicationId, 'no_driver', { ok: false, message: jdUrl });
    return;
  }

  // Greenhouse forms accept pdf/doc/docx/txt/rtf — never raw .tex.
  // Prefer the optimized PDF from Phase 2 if present; else if the original
  // upload was PDF, use it directly; else render one on-demand via the
  // ai-optimizer's /render-pdf endpoint from the parsed resume JSON in Mongo.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-'));
  const resumePdfPath = path.join(tmpDir, 'resume.pdf');
  const sourceType = app.resumeVersion.resume.sourceType;

  let pdfBytes: Buffer;
  if (app.resumeVersion.s3PdfKey) {
    pdfBytes = await getResume(app.resumeVersion.s3PdfKey);
    await recordEvent(applicationId, 'using_optimized_pdf');
  } else if (sourceType === 'pdf') {
    pdfBytes = await getResume(app.resumeVersion.resume.s3Key);
    await recordEvent(applicationId, 'using_original_pdf');
  } else {
    await recordEvent(applicationId, 'rendering_pdf', { message: `Source is .${sourceType}; rendering PDF via ai-optimizer` });
    const parsed = await loadParsedResume(app.resumeVersion.mongoDocId);
    if (!parsed) throw new Error('Parsed resume not found in Mongo');
    const renderRes = await fetch(`${process.env.OPTIMIZER_URL || 'http://ai-optimizer:8004'}/render-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: parsed }),
    });
    if (!renderRes.ok) throw new Error(`render-pdf failed: HTTP ${renderRes.status}`);
    const { pdf_b64 } = (await renderRes.json()) as any;
    pdfBytes = Buffer.from(pdf_b64, 'base64');
  }
  fs.writeFileSync(resumePdfPath, pdfBytes);

  await setStatus(applicationId, 'in_progress');
  await recordEvent(applicationId, 'start', { meta: { driver: driver.name, mode: app.mode, isResume } });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
  });
  const page = await context.newPage();

  const ctx: DriverContext = {
    page,
    jdUrl,
    profile,
    resumePdfPath,
    screenshot: async (label, opts) => {
      const png = await page.screenshot({ fullPage: opts?.fullPage });
      const key = await putScreenshot(applicationId, png, label);
      await recordEvent(applicationId, `screenshot:${label}`, { screenshotS3: key });
      return key;
    },
    event: async (step, opts) => recordEvent(applicationId, step, opts),
  };

  try {
    // Browser state isn't persisted across the awaiting_user pause, so we
    // re-run fillForm on every invocation (initial + resume). Idempotent.
    await driver.fillForm(ctx);

    const mode = config.forceReviewMode ? 'review' : app.mode;
    if (!isResume && mode !== 'auto') {
      await setStatus(applicationId, 'awaiting_user');
      await recordEvent(applicationId, 'awaiting_user', { message: 'Review form fill and screenshots, then approve to submit.' });
      return;
    }

    const result = await driver.submit(ctx);
    await setStatus(applicationId, 'submitted', { externalId: result.externalId, submittedAt: new Date() });
    await recordEvent(applicationId, 'submitted', { meta: { confirmation_preview: (result.confirmationText || '').slice(0, 400) } });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

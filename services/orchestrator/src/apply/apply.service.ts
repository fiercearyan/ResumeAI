import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../common/prisma.service';
import { S3Service } from '../common/s3.service';

const AUTO_APPLY_URL = process.env.AUTO_APPLY_URL || 'http://auto-apply:8005';
const APPLY_BUCKET = process.env.S3_BUCKET_APPLY || 'apply-artifacts';

@Injectable()
export class ApplyService {
  constructor(private prisma: PrismaService, private s3: S3Service) {}

  async create(userId: string, body: { jdId: string; resumeVersionId: string; mode?: 'review' | 'auto' }) {
    const mode = body.mode || 'review';
    const jd = await this.prisma.jobDescription.findUnique({ where: { id: body.jdId } });
    if (!jd) throw new NotFoundException('JD not found');
    if (!jd.sourceUrl) {
      throw new BadRequestException('This JD has no source URL; auto-apply needs a public posting URL.');
    }
    const version = await this.prisma.resumeVersion.findUnique({
      where: { id: body.resumeVersionId },
      include: { resume: true },
    });
    if (!version || version.resume.userId !== userId) throw new NotFoundException('Resume version not found');

    // Detect provider from URL.
    const platform = detectPlatform(jd.sourceUrl);
    if (!platform) {
      throw new BadRequestException(
        `No driver matches ${jd.sourceUrl}. Phase 3 supports Greenhouse (boards.greenhouse.io) only.`,
      );
    }

    // Daily cap enforcement.
    const prefs = await this.prisma.userPreference.findUnique({ where: { userId } });
    const dailyCap = prefs?.dailyApplyCap ?? 5;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await this.prisma.application.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (todayCount >= dailyCap) {
      throw new BadRequestException(`Daily cap reached (${todayCount}/${dailyCap}). Raise it in /settings/preferences.`);
    }

    const app = await this.prisma.application.create({
      data: {
        userId,
        jdId: body.jdId,
        resumeVersionId: body.resumeVersionId,
        platform,
        status: 'queued',
        mode,
      },
    });

    // Tell the auto-apply worker. Fire-and-forget — the worker also pulls
    // straight from Redis if the HTTP call fails.
    axios
      .post(`${AUTO_APPLY_URL}/enqueue`, { applicationId: app.id }, { timeout: 4_000 })
      .catch(() => {});

    return app;
  }

  async list(userId: string, filter: { status?: string } = {}) {
    return this.prisma.application.findMany({
      where: { userId, ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { jd: true, resumeVersion: true },
    });
  }

  async get(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({
      where: { id, userId },
      include: { jd: true, resumeVersion: true },
    });
    if (!app) throw new NotFoundException();
    const events = await this.prisma.applyEvent.findMany({
      where: { applicationId: id },
      orderBy: { id: 'asc' },
    });
    // Sign screenshot URLs.
    const eventsOut = await Promise.all(
      events.map(async (e) => ({
        id: Number(e.id),
        step: e.step,
        ok: e.ok,
        message: e.message,
        meta: e.meta,
        at: e.at,
        screenshotUrl: e.screenshotS3
          ? await this.s3.signedGetUrl(APPLY_BUCKET, e.screenshotS3, 600)
          : null,
      })),
    );
    return { application: app, events: eventsOut };
  }

  async approve(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!app) throw new NotFoundException();
    if (app.status !== 'awaiting_user') {
      throw new BadRequestException(`Cannot approve from status=${app.status}.`);
    }
    // Force auto for the resume run (one-shot opt-in).
    await this.prisma.application.update({ where: { id }, data: { mode: 'auto', status: 'queued' } });
    axios
      .post(`${AUTO_APPLY_URL}/resume/${id}`, {}, { timeout: 4_000 })
      .catch(() => {});
    return { ok: true };
  }

  async cancel(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!app) throw new NotFoundException();
    await this.prisma.application.update({ where: { id }, data: { status: 'failed', lastError: 'Cancelled by user' } });
    return { ok: true };
  }
}

function detectPlatform(url: string): string | null {
  try {
    const u = new URL(url);
    if (/(^|\.)greenhouse\.io$/.test(u.hostname)) return 'greenhouse';
    // Test fixture path used by the Phase 3 smoke test.
    if (/mock-greenhouse/.test(u.pathname)) return 'greenhouse';
    return null;
  } catch {
    return null;
  }
}

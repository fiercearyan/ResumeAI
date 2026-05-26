import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class LlmService {
  constructor(private prisma: PrismaService) {}

  async record(body: {
    userId?: string | null;
    service: string;
    model: string;
    endpoint?: string;
    inTokens: number;
    outTokens: number;
    costUsd: number;
    meta?: any;
  }) {
    await this.prisma.llmUsage.create({
      data: {
        userId: body.userId ?? null,
        service: body.service,
        model: body.model,
        endpoint: body.endpoint ?? null,
        inTokens: body.inTokens,
        outTokens: body.outTokens,
        costUsd: body.costUsd,
        meta: body.meta ?? undefined,
      },
    });
    return { ok: true };
  }

  /** Per-user totals for the last 30 days + lifetime + by-service breakdown. */
  async forUser(userId: string) {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [last30, lifetime, byService, recent] = await Promise.all([
      this.prisma.llmUsage.aggregate({
        where: { userId, at: { gte: since30 } },
        _sum: { inTokens: true, outTokens: true, costUsd: true },
        _count: { id: true },
      }),
      this.prisma.llmUsage.aggregate({
        where: { userId },
        _sum: { inTokens: true, outTokens: true, costUsd: true },
        _count: { id: true },
      }),
      this.prisma.llmUsage.groupBy({
        by: ['service'],
        where: { userId, at: { gte: since30 } },
        _sum: { costUsd: true, inTokens: true, outTokens: true },
        _count: { id: true },
      }),
      this.prisma.llmUsage.findMany({
        where: { userId },
        orderBy: { at: 'desc' },
        take: 20,
        select: { service: true, model: true, endpoint: true, inTokens: true, outTokens: true, costUsd: true, at: true },
      }),
    ]);
    return {
      last30Days: {
        callCount: last30._count.id,
        inTokens: last30._sum.inTokens ?? 0,
        outTokens: last30._sum.outTokens ?? 0,
        costUsd: Number((last30._sum.costUsd ?? 0).toFixed(4)),
      },
      lifetime: {
        callCount: lifetime._count.id,
        inTokens: lifetime._sum.inTokens ?? 0,
        outTokens: lifetime._sum.outTokens ?? 0,
        costUsd: Number((lifetime._sum.costUsd ?? 0).toFixed(4)),
      },
      byService: byService.map((s) => ({
        service: s.service,
        callCount: s._count.id,
        inTokens: s._sum.inTokens ?? 0,
        outTokens: s._sum.outTokens ?? 0,
        costUsd: Number((s._sum.costUsd ?? 0).toFixed(4)),
      })),
      recent,
    };
  }
}

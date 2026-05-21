import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../common/prisma.service';
import { PLANS, PlanKey, isUnlimited } from './plans';

type Feature = 'optimize' | 'apply';

/**
 * Plan-gating daily quota check.
 *
 * Free: 5/day per feature. Pro: unlimited. Counters in Redis keyed by
 * (feature, userId, yyyy-mm-dd). Returns 402 with structured body
 * { code: 'quota_exceeded', upgradeUrl } so the FE can pop an upgrade modal.
 */
abstract class BaseQuotaGuard implements CanActivate {
  private redis: Redis;
  protected abstract feature: Feature;

  constructor(protected prisma: PrismaService) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.redis.connect().catch(() => {});
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (req.method !== 'POST') return true;
    const userId = req.user?.id;
    if (!userId) return true; // AuthGuard handles missing token.

    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
    const plan = (u?.plan || 'free') as PlanKey;
    const quotaField = this.feature === 'optimize' ? 'optimizePerDay' : 'applyPerDay';
    const limit = PLANS[plan].quotas[quotaField];
    if (isUnlimited(limit)) return true;

    const day = new Date().toISOString().slice(0, 10);
    const key = `quota:${this.feature}:${userId}:${day}`;
    try {
      const v = await this.redis.incr(key);
      if (v === 1) await this.redis.expire(key, 86400 + 600);
      if (v > limit) {
        throw new HttpException(
          {
            statusCode: 402,
            code: 'quota_exceeded',
            feature: this.feature,
            plan,
            limit,
            used: v - 1,
            upgradeUrl: '/settings/billing',
            message: `Daily ${this.feature} limit (${limit}) reached on the ${plan} plan. Upgrade to Pro for unlimited.`,
          },
          402,
        );
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      if (process.env.NODE_ENV === 'production') {
        throw new HttpException('Quota service unavailable', 503);
      }
    }
    return true;
  }
}

@Injectable()
export class OptimizeQuotaGuard extends BaseQuotaGuard {
  protected feature: Feature = 'optimize';
  // Explicit constructor so TypeScript emits `design:paramtypes` metadata
  // for Nest's DI to inject PrismaService into the abstract base.
  constructor(prisma: PrismaService) { super(prisma); }
}

@Injectable()
export class ApplyQuotaGuard extends BaseQuotaGuard {
  protected feature: Feature = 'apply';
  constructor(prisma: PrismaService) { super(prisma); }
}

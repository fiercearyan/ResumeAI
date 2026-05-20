import { HttpException, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

/**
 * Sliding-window-ish rate limit on sensitive auth endpoints.
 * Backed by Redis INCR + EXPIRE; identical key collision policy per second.
 *
 * Limits are intentionally tight on auth endpoints to slow credential stuffing.
 */
const LIMITS: Record<string, { points: number; windowSec: number }> = {
  POST_signup:           { points: 5,  windowSec: 60 },
  POST_login:            { points: 10, windowSec: 60 },
  POST_mfa_verify:       { points: 5,  windowSec: 60 },
  POST_mfa_enroll_start: { points: 5,  windowSec: 60 },
  POST_mfa_enroll_confirm:{ points: 5, windowSec: 60 },
};

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private redis: Redis;
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    this.redis.connect().catch(() => {/* try later */});
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const path = (req.baseUrl + req.path)
      .replace(/^\/auth/, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')        // trim trailing slashes that some middleware mounts add
      .replace(/\//g, '_');
    const key = `${req.method}_${path}`;
    const limit = LIMITS[key];
    if (!limit) return next();

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown';
    const redisKey = `rl:${key}:${ip}`;
    try {
      const v = await this.redis.incr(redisKey);
      if (v === 1) await this.redis.expire(redisKey, limit.windowSec);
      if (v > limit.points) {
        throw new HttpException(
          { message: `Too many requests. Try again in ${limit.windowSec}s.`, code: 'rate_limited' },
          429,
        );
      }
    } catch (e: any) {
      if (e instanceof HttpException) throw e;
      // Redis unavailable — fail open in dev, deny in prod.
      if (process.env.NODE_ENV === 'production') {
        throw new HttpException('Rate limiter unavailable', 503);
      }
    }
    next();
  }
}

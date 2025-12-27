import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = env.RATE_LIMIT_PER_MIN;

const buckets = new Map<string, { count: number; resetAt: number }>();

const getKey = (req: Request) => {
  const fromId = (req as Request & { telegramFromId?: string }).telegramFromId;
  if (fromId) {
    return `user:${fromId}`;
  }
  return `ip:${req.ip}`;
};

export const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  const key = getKey(req);
  const now = Date.now();
  const bucket = buckets.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_REQUESTS) {
    return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });
  }

  return next();
};

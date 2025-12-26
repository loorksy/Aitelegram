import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export const webhookSecretGuard = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!env.WEBHOOK_SECRET) {
    return next();
  }

  const token = req.headers['x-telegram-bot-api-secret-token'];
  if (token !== env.WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }

  return next();
};

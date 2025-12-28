import { Request, Response, NextFunction } from 'express';
import { parseTelegramUpdate } from '../core/telegramUpdateParser';

export const telegramUpdateContext = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (typeof req.body === 'object' && req.body) {
    const parsed = parseTelegramUpdate(req.body as Record<string, unknown>);
    (req as Request & { telegramFromId?: string }).telegramFromId =
      parsed.fromId?.toString();
    (req as Request & { telegramUpdate?: typeof parsed }).telegramUpdate = parsed;
  }
  return next();
};

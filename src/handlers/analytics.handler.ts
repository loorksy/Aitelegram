import { Request, Response, NextFunction } from 'express';
import { exportAnalyticsCsv } from '../services/analytics.service';

export const exportAnalyticsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const botId = req.query.botId as string;
    if (!botId) {
      return res.status(400).json({ ok: false, error: 'botId is required' });
    }
    const csv = await exportAnalyticsCsv(botId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${botId}.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};

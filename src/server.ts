import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { masterBotHandler } from './handlers/masterBot.handler';
import { userBotHandler } from './handlers/userBot.handler';
import { mediaUploadHandler } from './handlers/mediaUpload.handler';
import { cleanupUnusedMedia } from './services/media.service';
import {
  clickLinkHandler,
  createLinkHandler,
  deleteLinkHandler,
  listLinksHandler,
  updateLinkHandler
} from './handlers/externalLink.handler';
import { listAllLinks } from './services/externalLink.service';
import { startNotificationWorkers } from './jobs/notificationQueue';
import { exportAnalyticsHandler } from './handlers/analytics.handler';
import { aggregateDailyAnalytics } from './services/analytics.service';
import { webhookSecretGuard } from './middleware/webhookSecret';
import { telegramUpdateContext } from './middleware/telegramUpdateContext';
import { rateLimit } from './middleware/rateLimit';

const app = express();

app.use(pinoHttp({ logger: logger as never }));
app.use(helmet());
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  })
);
app.use(compression());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

if (!env.WEBHOOK_SECRET) {
  logger.warn('WEBHOOK_SECRET is not set. Telegram webhook secret validation is disabled.');
}

app.post(
  '/master/webhook',
  telegramUpdateContext,
  rateLimit,
  webhookSecretGuard,
  masterBotHandler
);

app.post(
  '/tg/:botId/webhook',
  telegramUpdateContext,
  rateLimit,
  webhookSecretGuard,
  userBotHandler
);

app.post('/media/upload', mediaUploadHandler);

app.post('/links', createLinkHandler);
app.get('/links', listLinksHandler);
app.patch('/links/:id', updateLinkHandler);
app.delete('/links/:id', deleteLinkHandler);
app.post('/links/:id/click', clickLinkHandler);

app.get('/analytics/export', exportAnalyticsHandler);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`);
});

startNotificationWorkers();

setInterval(async () => {
  try {
    const cleaned = await cleanupUnusedMedia(env.MEDIA_CLEANUP_DAYS);
    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} unused media items`);
    }
  } catch (error) {
    logger.error({ err: error }, 'Media cleanup failed');
  }
}, 24 * 60 * 60 * 1000);

setInterval(async () => {
  try {
    const links = await listAllLinks();
    for (const link of links) {
      const response = await fetch(link.url, { method: 'HEAD' });
      if (!response.ok) {
        logger.warn({ linkId: link.id }, 'External link health check failed');
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'External link health check failed');
  }
}, 7 * 24 * 60 * 60 * 1000);

setInterval(async () => {
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    await aggregateDailyAnalytics(yesterday);
  } catch (error) {
    logger.error({ err: error }, 'Daily analytics aggregation failed');
  }
}, 24 * 60 * 60 * 1000);

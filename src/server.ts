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
import { debugLLMHealth, getModelInfo } from './ai/openaiClient';
import adminRoutes from './routes/admin.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';
import botRoutes from './routes/bot.routes';
import systemRoutes from './routes/system.routes';

const app = express();

// Trust proxy for secure cookies behind reverse proxy
app.set('trust proxy', 1);

// Production logging - minimal in production
if (process.env.NODE_ENV === 'production') {
  app.use(pinoHttp({
    logger: logger as never,
    autoLogging: false // Disable auto logging in production
  }));
} else {
  app.use(pinoHttp({ logger: logger as never }));
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false
}));

// CORS - Production configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://app.lork.cloud'];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);
app.use(compression() as unknown as express.RequestHandler);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// API health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-agent-factory-api' });
});

// Debug endpoint for LLM health check
app.get('/debug/llm', async (_req, res) => {
  try {
    const modelInfo = getModelInfo();
    const healthResult = await debugLLMHealth();
    res.json({
      ...healthResult,
      config: modelInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const err = error as { message?: string };
    res.status(500).json({
      ok: false,
      error: err.message ?? 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

if (!env.WEBHOOK_SECRET) {
  logger.warn('WEBHOOK_SECRET is not set. Telegram webhook secret validation is disabled.');
}

// API Routes
app.use('/api', adminRoutes);
app.use('/api', paymentRoutes);
app.use('/api', botRoutes);
app.use('/api', systemRoutes);

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

app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`🚀 AI Agent Factory API running on 0.0.0.0:${env.PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Base URL: ${process.env.BASE_URL || 'http://localhost:' + env.PORT}`);
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

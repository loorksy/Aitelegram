import { Router, Request, Response } from 'express';
import { UserRole, UserStatus, PaymentStatus, AgentRunStatus } from '@prisma/client';
import {
  authenticate,
  requireRole,
  AuthenticatedRequest,
  createUserToken,
  refreshAccessToken
} from '../middleware/auth';
import {
  getUsers,
  getUserById,
  approveUser,
  denyUser,
  setUserCredits,
  setUserDailyLimit,
  setUserRole,
  getAgentRuns,
  getSystemStats
} from '../services/admin.service';
import { getAllPayments, getPaymentById } from '../services/payment.service';
import { logger } from '../utils/logger';

const router = Router();

// ==================== AUTH ENDPOINTS ====================

/**
 * POST /api/auth/token
 * Generate token for a user (by telegramId) - for testing/admin use
 */
router.post('/auth/token', async (req: Request, res: Response) => {
  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }
    
    const result = await createUserToken(telegramId);
    
    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to generate token');
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }
    
    const result = await refreshAccessToken(refreshToken);
    
    if (!result) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Failed to refresh token');
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user?.dbUser });
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/admin/stats
 * Get system statistics
 */
router.get(
  '/admin/stats',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (_req: Request, res: Response) => {
    try {
      const stats = await getSystemStats();
      res.json(stats);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get stats');
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }
);

/**
 * GET /api/admin/users
 * Get all users with filters
 */
router.get(
  '/admin/users',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { status, role, search, limit, offset } = req.query;
      
      const result = await getUsers({
        status: status as UserStatus | undefined,
        role: role as UserRole | undefined,
        search: search as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get users');
      res.status(500).json({ error: 'Failed to get users' });
    }
  }
);

/**
 * GET /api/admin/users/:id
 * Get user by ID
 */
router.get(
  '/admin/users/:id',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const user = await getUserById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get user');
      res.status(500).json({ error: 'Failed to get user' });
    }
  }
);

/**
 * POST /api/admin/users/:id/approve
 * Approve a user
 */
router.post(
  '/admin/users/:id/approve',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { initialCredits } = req.body;
      
      const result = await approveUser(
        req.params.id,
        req.user!.userId,
        initialCredits
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, message: 'User approved successfully' });
    } catch (error) {
      logger.error({ err: error }, 'Failed to approve user');
      res.status(500).json({ error: 'Failed to approve user' });
    }
  }
);

/**
 * POST /api/admin/users/:id/deny
 * Deny a user
 */
router.post(
  '/admin/users/:id/deny',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reason } = req.body;
      
      const result = await denyUser(req.params.id, req.user!.userId, reason);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, message: 'User denied successfully' });
    } catch (error) {
      logger.error({ err: error }, 'Failed to deny user');
      res.status(500).json({ error: 'Failed to deny user' });
    }
  }
);

/**
 * POST /api/admin/users/:id/set-credits
 * Set user credits
 */
router.post(
  '/admin/users/:id/set-credits',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { credits, reason } = req.body;
      
      if (typeof credits !== 'number' || credits < 0) {
        return res.status(400).json({ error: 'Invalid credits value' });
      }
      
      const result = await setUserCredits(
        req.params.id,
        credits,
        req.user!.userId,
        reason
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({
        success: true,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to set credits');
      res.status(500).json({ error: 'Failed to set credits' });
    }
  }
);

/**
 * POST /api/admin/users/:id/set-daily-limit
 * Set user daily credits limit
 */
router.post(
  '/admin/users/:id/set-daily-limit',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { dailyLimit } = req.body;
      
      if (typeof dailyLimit !== 'number' || dailyLimit < 0) {
        return res.status(400).json({ error: 'Invalid dailyLimit value' });
      }
      
      const result = await setUserDailyLimit(
        req.params.id,
        dailyLimit,
        req.user!.userId
      );
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, dailyLimit });
    } catch (error) {
      logger.error({ err: error }, 'Failed to set daily limit');
      res.status(500).json({ error: 'Failed to set daily limit' });
    }
  }
);

/**
 * POST /api/admin/users/:id/set-role
 * Set user role
 */
router.post(
  '/admin/users/:id/set-role',
  authenticate,
  requireRole(UserRole.OWNER),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role } = req.body;
      
      if (!Object.values(UserRole).includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      
      const result = await setUserRole(req.params.id, role, req.user!.userId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ success: true, role });
    } catch (error) {
      logger.error({ err: error }, 'Failed to set role');
      res.status(500).json({ error: 'Failed to set role' });
    }
  }
);

/**
 * GET /api/admin/payments
 * Get all payments
 */
router.get(
  '/admin/payments',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { status, provider, limit, offset } = req.query;
      
      const result = await getAllPayments({
        status: status as PaymentStatus | undefined,
        provider: provider as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get payments');
      res.status(500).json({ error: 'Failed to get payments' });
    }
  }
);

/**
 * GET /api/admin/payments/:id
 * Get payment by ID
 */
router.get(
  '/admin/payments/:id',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const payment = await getPaymentById(req.params.id);
      
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      
      res.json(payment);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get payment');
      res.status(500).json({ error: 'Failed to get payment' });
    }
  }
);

/**
 * GET /api/admin/runs
 * Get agent runs with filters
 */
router.get(
  '/admin/runs',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { userId, status, limit, offset } = req.query;
      
      const result = await getAgentRuns({
        userId: userId as string | undefined,
        status: status as AgentRunStatus | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });
      
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get runs');
      res.status(500).json({ error: 'Failed to get runs' });
    }
  }
);

// ==================== SYSTEM HEALTH ENDPOINTS ====================

/**
 * GET /api/admin/system/health
 * Get comprehensive system health status
 */
router.get(
  '/admin/system/health',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (_req: Request, res: Response) => {
    const { prisma } = await import('../core/prisma');
    const { env } = await import('../config/env');
    
    const health: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      database: { status: 'unknown' },
      telegram: { status: 'unknown' },
      migrations: { status: 'unknown' }
    };
    
    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = { status: 'ok' };
    } catch (error) {
      health.database = { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown' 
      };
    }
    
    // Check Telegram Master Bot
    try {
      const { getMe } = await import('../core/telegram');
      const botInfo = await getMe(env.MASTER_BOT_TOKEN);
      health.telegram = { 
        status: 'ok', 
        botUsername: botInfo.username,
        botId: botInfo.id
      };
    } catch (error) {
      health.telegram = { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown' 
      };
    }
    
    // Check migrations status
    try {
      const appliedMigrations = await prisma.$queryRaw<{ migration_name: string }[]>`
        SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
      `;
      health.migrations = { 
        status: 'ok', 
        count: appliedMigrations.length 
      };
    } catch {
      health.migrations = { status: 'warning', message: 'Could not check migrations' };
    }
    
    // Count bots by webhook status
    try {
      const botStats = await prisma.bot.groupBy({
        by: ['webhookStatus'],
        _count: true
      });
      health.bots = {
        byWebhookStatus: botStats.reduce((acc, curr) => {
          acc[curr.webhookStatus || 'null'] = curr._count;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch {
      health.bots = { status: 'warning', message: 'Could not get bot stats' };
    }
    
    const overallStatus = 
      (health.database as Record<string, unknown>)?.status === 'ok' && 
      (health.telegram as Record<string, unknown>)?.status === 'ok' 
        ? 'healthy' 
        : 'degraded';
    
    res.json({ status: overallStatus, ...health });
  }
);

/**
 * GET /api/admin/bots/:botId/webhook-status
 * Get detailed webhook status for a specific bot
 */
router.get(
  '/admin/bots/:botId/webhook-status',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { prisma } = await import('../core/prisma');
      const { getWebhookInfo } = await import('../core/telegram');
      const { decrypt } = await import('../core/encryption');
      
      const bot = await prisma.bot.findUnique({
        where: { id: req.params.botId },
        select: {
          id: true,
          name: true,
          telegramUser: true,
          telegramBotId: true,
          webhookUrl: true,
          webhookStatus: true,
          webhookError: true,
          webhookCheckedAt: true,
          tokenCipherText: true,
          tokenIv: true,
          tokenTag: true,
          status: true
        }
      });
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      // Try to get live webhook info if token exists
      let liveWebhookInfo = null;
      if (bot.tokenCipherText && bot.tokenIv && bot.tokenTag) {
        try {
          const token = decrypt(bot.tokenCipherText, bot.tokenIv, bot.tokenTag);
          liveWebhookInfo = await getWebhookInfo(token);
        } catch (error) {
          logger.warn({ botId: bot.id, error }, 'Could not fetch live webhook info');
        }
      }
      
      res.json({
        bot: {
          id: bot.id,
          name: bot.name,
          telegramUser: bot.telegramUser,
          status: bot.status
        },
        stored: {
          webhookUrl: bot.webhookUrl,
          webhookStatus: bot.webhookStatus,
          webhookError: bot.webhookError,
          lastChecked: bot.webhookCheckedAt
        },
        live: liveWebhookInfo ? {
          url: liveWebhookInfo.url,
          hasError: !!liveWebhookInfo.last_error_message,
          lastError: liveWebhookInfo.last_error_message,
          pendingUpdates: liveWebhookInfo.pending_update_count
        } : null
      });
    } catch (error) {
      logger.error({ err: error, botId: req.params.botId }, 'Failed to get webhook status');
      res.status(500).json({ error: 'Failed to get webhook status' });
    }
  }
);

/**
 * POST /api/admin/bots/:botId/republish
 * Force republish a bot (refresh webhook)
 */
router.post(
  '/admin/bots/:botId/republish',
  authenticate,
  requireRole(UserRole.OWNER, UserRole.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { prisma } = await import('../core/prisma');
      const { setWebhookWithValidation, getValidWebhookSecret, getMe } = await import('../core/telegram');
      const { decrypt } = await import('../core/encryption');
      const { env } = await import('../config/env');
      
      const bot = await prisma.bot.findUnique({
        where: { id: req.params.botId }
      });
      
      if (!bot) {
        return res.status(404).json({ error: 'Bot not found' });
      }
      
      if (!bot.tokenCipherText || !bot.tokenIv || !bot.tokenTag) {
        return res.status(400).json({ error: 'Bot has no token configured' });
      }
      
      // Decrypt token
      const token = decrypt(bot.tokenCipherText, bot.tokenIv, bot.tokenTag);
      
      // Validate token
      const botInfo = await getMe(token);
      
      // Set webhook
      const webhookUrl = `${env.BASE_URL}/tg/${bot.id}/webhook`;
      const validSecret = getValidWebhookSecret(bot.webhookSecret || env.WEBHOOK_SECRET);
      
      const result = await setWebhookWithValidation(token, webhookUrl, validSecret);
      
      // Update bot
      await prisma.bot.update({
        where: { id: bot.id },
        data: {
          telegramUser: botInfo.username,
          telegramBotId: botInfo.id.toString(),
          webhookUrl,
          webhookSecret: validSecret,
          webhookStatus: result.success ? 'WEBHOOK_OK' : 'WEBHOOK_FAILED',
          webhookError: result.error || null,
          webhookCheckedAt: new Date(),
          status: result.success ? 'WEBHOOK_OK' : 'WEBHOOK_FAILED'
        }
      });
      
      res.json({
        success: result.success,
        botUsername: botInfo.username,
        webhookUrl,
        error: result.error
      });
    } catch (error) {
      logger.error({ err: error, botId: req.params.botId }, 'Failed to republish bot');
      res.status(500).json({ error: 'Failed to republish bot' });
    }
  }
);

export default router;

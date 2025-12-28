import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  createPayment,
  processSuccessfulPayment,
  handlePreCheckoutQuery,
  getUserPayments,
  getPaymentById,
  PAYMENT_MODE,
  STARS_TO_CREDITS_RATE,
  CREDIT_PACKAGES,
  getPaymentStats
} from '../services/payment.service';
import { getBalanceSummary, getCreditHistory } from '../services/credits.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/payments/config
 * Get payment configuration
 */
router.get('/payments/config', (_req: Request, res: Response) => {
  res.json({
    mode: PAYMENT_MODE,
    starsToCreditsRate: STARS_TO_CREDITS_RATE,
    currency: 'XTR',
    packages: CREDIT_PACKAGES
  });
});

/**
 * GET /api/credits/balance
 * Get user's credit balance and usage
 */
router.get(
  '/credits/balance',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const summary = await getBalanceSummary(req.user!.userId);
      
      if (!summary) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(summary);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get balance');
      res.status(500).json({ error: 'Failed to get balance' });
    }
  }
);

/**
 * GET /api/credits/history
 * Get user's credit transaction history
 */
router.get(
  '/credits/history',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { limit } = req.query;
      const history = await getCreditHistory(
        req.user!.userId,
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json({ transactions: history });
    } catch (error) {
      logger.error({ err: error }, 'Failed to get credit history');
      res.status(500).json({ error: 'Failed to get credit history' });
    }
  }
);

/**
 * POST /api/payments/create
 * Create a new payment and get invoice link
 */
router.post(
  '/payments/create',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { starsAmount, packageId, chatId } = req.body;
      
      // Validate input
      if (!starsAmount || typeof starsAmount !== 'number' || starsAmount < 1) {
        return res.status(400).json({ error: 'Invalid starsAmount' });
      }
      
      // Validate package if provided
      if (packageId) {
        const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
        if (!pkg) {
          return res.status(400).json({ error: 'Invalid package' });
        }
      }
      
      const result = await createPayment({
        userId: req.user!.userId,
        starsAmount,
        packageId,
        chatId
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error, paymentId: result.paymentId });
      }
      
      res.json({
        success: true,
        paymentId: result.paymentId,
        invoiceLink: result.invoiceLink,
        invoiceUrl: result.invoiceUrl,
        creditsToReceive: starsAmount * STARS_TO_CREDITS_RATE
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to create payment');
      res.status(500).json({ error: 'Failed to create payment' });
    }
  }
);

/**
 * GET /api/payments/history
 * Get user's payment history
 */
router.get(
  '/payments/history',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { limit } = req.query;
      const payments = await getUserPayments(
        req.user!.userId,
        limit ? parseInt(limit as string) : undefined
      );
      
      res.json({ payments });
    } catch (error) {
      logger.error({ err: error }, 'Failed to get payment history');
      res.status(500).json({ error: 'Failed to get payment history' });
    }
  }
);

/**
 * GET /api/payments/:id
 * Get payment by ID
 */
router.get(
  '/payments/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const payment = await getPaymentById(req.params.id);
      
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      
      // Users can only see their own payments
      if (payment.userId !== req.user!.userId && req.user!.role === 'USER') {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      res.json(payment);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get payment');
      res.status(500).json({ error: 'Failed to get payment' });
    }
  }
);

/**
 * POST /api/payments/webhook/telegram
 * Telegram Stars payment webhook
 * Handles: pre_checkout_query, successful_payment
 */
router.post('/payments/webhook/telegram', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    
    logger.info({ updateId: update.update_id }, 'Telegram payment webhook received');
    
    // Handle pre_checkout_query
    if (update.pre_checkout_query) {
      const query = update.pre_checkout_query;
      logger.info(
        { queryId: query.id, payload: query.invoice_payload, amount: query.total_amount },
        'Pre-checkout query received'
      );
      
      const result = await handlePreCheckoutQuery({
        id: query.id,
        from: query.from,
        currency: query.currency,
        total_amount: query.total_amount,
        invoice_payload: query.invoice_payload
      });
      
      if (!result.ok) {
        logger.warn({ queryId: query.id, error: result.error }, 'Pre-checkout query rejected');
      }
      
      return res.json({ ok: true });
    }
    
    // Handle successful_payment (comes as message.successful_payment)
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const paymentId = payment.invoice_payload;
      
      logger.info(
        { 
          paymentId,
          telegramChargeId: payment.telegram_payment_charge_id,
          totalAmount: payment.total_amount,
          fromUserId: update.message.from?.id
        },
        'Successful payment received'
      );
      
      const result = await processSuccessfulPayment(
        paymentId,
        payment.telegram_payment_charge_id,
        {
          telegramChargeId: payment.telegram_payment_charge_id,
          providerChargeId: payment.provider_payment_charge_id,
          totalAmount: payment.total_amount,
          currency: payment.currency,
          from: update.message.from,
          date: update.message.date
        }
      );
      
      if (!result.success) {
        logger.error({ error: result.error, paymentId }, 'Failed to process successful payment');
      } else {
        logger.info({ paymentId, creditsAdded: result.creditsAdded }, 'Payment processed');
      }
      
      return res.json({ ok: true });
    }
    
    // Unknown update type - acknowledge anyway
    res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, 'Telegram webhook error');
    // Always return 200 to prevent Telegram from retrying
    res.json({ ok: true, error: 'Internal error' });
  }
});

/**
 * GET /api/payments/stats
 * Get payment statistics (admin only)
 */
router.get('/payments/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user!.role === 'USER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const stats = await getPaymentStats();
    res.json(stats);
  } catch (error) {
    logger.error({ err: error }, 'Failed to get payment stats');
    res.status(500).json({ error: 'Failed to get payment stats' });
  }
});

export default router;

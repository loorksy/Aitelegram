import { PaymentProvider, PaymentStatus, CreditTransactionType } from '@prisma/client';
import { prisma } from '../core/prisma';
import { logger } from '../utils/logger';
import { addCredits } from './credits.service';
import { env } from '../config/env';
import { auditPaymentAction, AuditAction } from './audit.service';

// Configuration
export const STARS_TO_CREDITS_RATE = parseInt(process.env.STARS_TO_CREDITS_RATE || '10');
export const PAYMENT_MODE = process.env.PAYMENT_MODE || 'REAL';

// Credit packages available for purchase
export const CREDIT_PACKAGES = [
  { id: 'pkg_100', stars: 10, credits: 100, label: '100 رصيد', labelEn: '100 Credits' },
  { id: 'pkg_250', stars: 25, credits: 250, label: '250 رصيد', labelEn: '250 Credits' },
  { id: 'pkg_500', stars: 50, credits: 500, label: '500 رصيد', labelEn: '500 Credits' },
  { id: 'pkg_1000', stars: 100, credits: 1000, label: '1000 رصيد', labelEn: '1000 Credits' }
];

export interface CreatePaymentInput {
  userId: string;
  starsAmount: number;
  chatId?: number;
  packageId?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  invoiceUrl?: string;
  invoiceLink?: string;
  error?: string;
}

/**
 * Calculate credits from stars
 */
export const starsToCredits = (stars: number): number => {
  return stars * STARS_TO_CREDITS_RATE;
};

/**
 * Create Telegram Stars invoice link using Bot API
 * This creates a shareable payment link
 */
export const createTelegramStarsInvoice = async (
  paymentId: string,
  starsAmount: number,
  title: string,
  description: string
): Promise<{ success: boolean; invoiceLink?: string; error?: string }> => {
  const botToken = env.MASTER_BOT_TOKEN;
  
  if (!botToken || botToken === 'YOUR_TELEGRAM_BOT_TOKEN') {
    logger.error('Bot token not configured for payments');
    return { success: false, error: 'Payment system not configured' };
  }
  
  try {
    // Create invoice link for Telegram Stars
    // For digital goods/Stars: provider_token must be empty, currency = "XTR"
    const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        payload: paymentId,
        currency: 'XTR', // Telegram Stars currency
        prices: [{ label: title, amount: starsAmount }],
        provider_token: '' // Empty for Stars/digital goods
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      logger.error({ data, paymentId }, 'Failed to create Telegram invoice');
      return { success: false, error: data.description || 'Failed to create invoice' };
    }
    
    logger.info({ paymentId, invoiceLink: data.result }, 'Invoice link created');
    return { success: true, invoiceLink: data.result };
  } catch (error) {
    logger.error({ err: error, paymentId }, 'Telegram API error');
    return { success: false, error: 'Telegram API error' };
  }
};

/**
 * Send invoice directly to user's chat
 */
export const sendTelegramInvoice = async (
  chatId: number,
  paymentId: string,
  starsAmount: number,
  title: string,
  description: string
): Promise<{ success: boolean; messageId?: number; error?: string }> => {
  const botToken = env.MASTER_BOT_TOKEN;
  
  if (!botToken || botToken === 'YOUR_TELEGRAM_BOT_TOKEN') {
    return { success: false, error: 'Bot token not configured' };
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendInvoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        title,
        description,
        payload: paymentId,
        currency: 'XTR',
        prices: [{ label: title, amount: starsAmount }],
        provider_token: ''
      })
    });
    
    const data = await response.json();
    
    if (!data.ok) {
      logger.error({ data, chatId, paymentId }, 'Failed to send Telegram invoice');
      return { success: false, error: data.description || 'Failed to send invoice' };
    }
    
    logger.info({ paymentId, chatId, messageId: data.result.message_id }, 'Invoice sent');
    return { success: true, messageId: data.result.message_id };
  } catch (error) {
    logger.error({ err: error, paymentId, chatId }, 'Telegram API error');
    return { success: false, error: 'Telegram API error' };
  }
};

/**
 * Answer pre-checkout query from Telegram
 */
export const answerPreCheckoutQuery = async (
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string
): Promise<boolean> => {
  const botToken = env.MASTER_BOT_TOKEN;
  
  if (!botToken) return false;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: preCheckoutQueryId,
        ok,
        error_message: ok ? undefined : errorMessage
      })
    });
    
    const data = await response.json();
    logger.info({ preCheckoutQueryId, ok, response: data.ok }, 'Pre-checkout query answered');
    return data.ok === true;
  } catch (error) {
    logger.error({ err: error, preCheckoutQueryId }, 'Failed to answer pre-checkout query');
    return false;
  }
};

/**
 * Create a new payment
 */
export const createPayment = async (input: CreatePaymentInput): Promise<PaymentResult> => {
  const creditsAmount = starsToCredits(input.starsAmount);
  
  // Find package info
  const pkg = CREDIT_PACKAGES.find(p => p.stars === input.starsAmount || p.id === input.packageId);
  const title = pkg ? pkg.label : `${creditsAmount} رصيد`;
  const description = `شحن ${creditsAmount} رصيد - AI Agent Factory`;
  
  try {
    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        userId: input.userId,
        amount: creditsAmount,
        starsAmount: input.starsAmount,
        provider: PaymentProvider.TELEGRAM_STARS,
        status: PaymentStatus.PENDING,
        providerPayload: {
          packageId: input.packageId,
          chatId: input.chatId,
          createdAt: new Date().toISOString()
        }
      }
    });
    
    logger.info(
      { paymentId: payment.id, userId: input.userId, stars: input.starsAmount, credits: creditsAmount },
      'Payment record created'
    );
    
    // Audit log
    await auditPaymentAction(AuditAction.PAYMENT_CREATED, input.userId, payment.id, {
      starsAmount: input.starsAmount,
      creditsAmount
    });
    
    // If chatId provided, send invoice directly
    if (input.chatId) {
      const invoiceResult = await sendTelegramInvoice(
        input.chatId,
        payment.id,
        input.starsAmount,
        title,
        description
      );
      
      if (!invoiceResult.success) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED, errorMessage: invoiceResult.error }
        });
        return { success: false, paymentId: payment.id, error: invoiceResult.error };
      }
      
      return {
        success: true,
        paymentId: payment.id,
        invoiceUrl: 'invoice_sent_to_chat'
      };
    }
    
    // Create invoice link
    const linkResult = await createTelegramStarsInvoice(
      payment.id,
      input.starsAmount,
      title,
      description
    );
    
    if (!linkResult.success) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, errorMessage: linkResult.error }
      });
      return { success: false, paymentId: payment.id, error: linkResult.error };
    }
    
    // Update payment with invoice link
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        invoiceId: linkResult.invoiceLink,
        providerPayload: {
          ...(payment.providerPayload as object),
          invoiceLink: linkResult.invoiceLink
        }
      }
    });
    
    return {
      success: true,
      paymentId: payment.id,
      invoiceLink: linkResult.invoiceLink
    };
  } catch (error) {
    logger.error({ err: error, userId: input.userId }, 'Failed to create payment');
    return { success: false, error: 'Failed to create payment' };
  }
};

/**
 * Handle pre-checkout query from Telegram webhook
 */
export const handlePreCheckoutQuery = async (query: {
  id: string;
  from: { id: number };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}): Promise<{ ok: boolean; error?: string }> => {
  const paymentId = query.invoice_payload;
  
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true }
    });
    
    if (!payment) {
      logger.warn({ paymentId, queryId: query.id }, 'Pre-checkout: payment not found');
      await answerPreCheckoutQuery(query.id, false, 'Payment not found');
      return { ok: false, error: 'Payment not found' };
    }
    
    if (payment.status !== PaymentStatus.PENDING) {
      logger.warn({ paymentId, status: payment.status }, 'Pre-checkout: payment not pending');
      await answerPreCheckoutQuery(query.id, false, 'Payment already processed');
      return { ok: false, error: 'Payment already processed' };
    }
    
    // Verify amount
    if (query.total_amount !== payment.starsAmount) {
      logger.warn({ paymentId, expected: payment.starsAmount, got: query.total_amount }, 'Pre-checkout: amount mismatch');
      await answerPreCheckoutQuery(query.id, false, 'Amount mismatch');
      return { ok: false, error: 'Amount mismatch' };
    }
    
    // All good, approve
    const answered = await answerPreCheckoutQuery(query.id, true);
    
    if (!answered) {
      return { ok: false, error: 'Failed to answer pre-checkout query' };
    }
    
    logger.info({ paymentId, queryId: query.id, userId: payment.userId }, 'Pre-checkout approved');
    return { ok: true };
  } catch (error) {
    logger.error({ err: error, paymentId }, 'Error handling pre-checkout query');
    await answerPreCheckoutQuery(query.id, false, 'Internal error');
    return { ok: false, error: 'Internal error' };
  }
};

/**
 * Process successful payment (called from webhook)
 */
export const processSuccessfulPayment = async (
  paymentId: string,
  telegramChargeId?: string,
  providerPayload?: unknown
): Promise<{ success: boolean; creditsAdded?: number; error?: string }> => {
  try {
    const payment = await prisma.payment.findUnique({ 
      where: { id: paymentId },
      include: { user: true }
    });
    
    if (!payment) {
      logger.error({ paymentId }, 'Payment not found for processing');
      return { success: false, error: 'Payment not found' };
    }
    
    if (payment.status === PaymentStatus.PAID) {
      logger.warn({ paymentId }, 'Payment already processed');
      return { success: false, error: 'Payment already processed' };
    }
    
    // Update payment status
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        chargeId: telegramChargeId,
        providerPayload: providerPayload as any,
        paidAt: new Date()
      }
    });
    
    // Add credits to user
    const creditResult = await addCredits(
      payment.userId,
      payment.amount,
      CreditTransactionType.TOPUP,
      `telegram_stars_purchase`,
      paymentId
    );
    
    if (!creditResult.success) {
      // Rollback payment status
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.PENDING, paidAt: null }
      });
      logger.error({ paymentId }, 'Failed to add credits, payment rolled back');
      return { success: false, error: 'Failed to add credits' };
    }
    
    // Audit log
    await auditPaymentAction(AuditAction.PAYMENT_COMPLETED, payment.userId, paymentId, {
      creditsAdded: payment.amount,
      telegramChargeId,
      newBalance: creditResult.newBalance
    });
    
    logger.info(
      { paymentId, userId: payment.userId, creditsAdded: payment.amount, newBalance: creditResult.newBalance },
      'Payment processed successfully'
    );
    
    return { success: true, creditsAdded: payment.amount };
  } catch (error) {
    logger.error({ err: error, paymentId }, 'Failed to process payment');
    return { success: false, error: 'Failed to process payment' };
  }
};

/**
 * Mark payment as failed
 */
export const processFailedPayment = async (
  paymentId: string,
  errorMessage: string,
  providerPayload?: unknown
): Promise<{ success: boolean }> => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    
    if (!payment) {
      return { success: false };
    }
    
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        errorMessage,
        providerPayload: providerPayload as any
      }
    });
    
    // Audit log
    await auditPaymentAction(AuditAction.PAYMENT_FAILED, payment.userId, paymentId, {
      errorMessage
    });
    
    logger.warn({ paymentId, errorMessage }, 'Payment marked as failed');
    return { success: true };
  } catch (error) {
    logger.error({ err: error, paymentId }, 'Failed to update payment status');
    return { success: false };
  }
};

/**
 * Get user payments history
 */
export const getUserPayments = async (userId: string, limit = 50) => {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
};

/**
 * Get all payments (admin)
 */
export const getAllPayments = async (options: {
  status?: PaymentStatus;
  provider?: PaymentProvider;
  limit?: number;
  offset?: number;
}) => {
  const where: any = {};
  if (options.status) where.status = options.status;
  if (options.provider) where.provider = options.provider;
  
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
      include: {
        user: { select: { id: true, name: true, username: true, telegramId: true } }
      }
    }),
    prisma.payment.count({ where })
  ]);
  
  return { payments, total };
};

/**
 * Get payment by ID
 */
export const getPaymentById = async (paymentId: string) => {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { id: true, name: true, username: true, telegramId: true } }
    }
  });
};

/**
 * Get payment statistics
 */
export const getPaymentStats = async () => {
  const [total, paid, pending, failed, revenue] = await Promise.all([
    prisma.payment.count(),
    prisma.payment.count({ where: { status: PaymentStatus.PAID } }),
    prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
    prisma.payment.count({ where: { status: PaymentStatus.FAILED } }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.PAID },
      _sum: { starsAmount: true, amount: true }
    })
  ]);
  
  return {
    total,
    paid,
    pending,
    failed,
    totalStarsRevenue: revenue._sum.starsAmount ?? 0,
    totalCreditsIssued: revenue._sum.amount ?? 0
  };
};

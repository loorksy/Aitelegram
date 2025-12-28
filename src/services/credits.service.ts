import { CreditTransactionType, Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../core/prisma';
import { logger } from '../utils/logger';

// Cost per pipeline run (configurable)
export const PIPELINE_COST = 10;

export interface CreditCheckResult {
  allowed: boolean;
  reason?: string;
  currentBalance?: number;
  dailyUsed?: number;
  dailyLimit?: number;
}

/**
 * Check if user has sufficient credits and daily limit
 */
export const checkUserCredits = async (userId: string): Promise<CreditCheckResult> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (!user) {
    return { allowed: false, reason: 'user_not_found' };
  }
  
  // Check approval status
  if (user.status !== UserStatus.APPROVED) {
    return { 
      allowed: false, 
      reason: `user_status_${user.status.toLowerCase()}`,
      currentBalance: user.credits
    };
  }
  
  // Reset daily credits if new day
  const now = new Date();
  const lastReset = new Date(user.lastCreditReset);
  if (now.toDateString() !== lastReset.toDateString()) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyCreditsUsed: 0, lastCreditReset: now }
    });
    user.dailyCreditsUsed = 0;
  }
  
  // Check daily limit
  if (user.dailyCreditsUsed + PIPELINE_COST > user.dailyCreditsLimit) {
    return {
      allowed: false,
      reason: 'daily_limit_exceeded',
      currentBalance: user.credits,
      dailyUsed: user.dailyCreditsUsed,
      dailyLimit: user.dailyCreditsLimit
    };
  }
  
  // Check balance
  if (user.credits < PIPELINE_COST) {
    return {
      allowed: false,
      reason: 'insufficient_credits',
      currentBalance: user.credits
    };
  }
  
  return {
    allowed: true,
    currentBalance: user.credits,
    dailyUsed: user.dailyCreditsUsed,
    dailyLimit: user.dailyCreditsLimit
  };
};

/**
 * Deduct credits for a pipeline run
 */
export const deductCredits = async (
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<{ success: boolean; newBalance: number; transactionId?: string }> => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current user
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.credits < amount) {
        throw new Error('Insufficient credits');
      }
      
      const newBalance = user.credits - amount;
      
      // Update user credits
      await tx.user.update({
        where: { id: userId },
        data: {
          credits: newBalance,
          dailyCreditsUsed: { increment: amount }
        }
      });
      
      // Create transaction record
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: CreditTransactionType.DEDUCTION,
          reason,
          balanceAfter: newBalance,
          referenceId
        }
      });
      
      return { newBalance, transactionId: transaction.id };
    });
    
    logger.info({ userId, amount, newBalance: result.newBalance }, 'Credits deducted');
    return { success: true, ...result };
  } catch (error) {
    logger.error({ err: error, userId, amount }, 'Failed to deduct credits');
    return { success: false, newBalance: 0 };
  }
};

/**
 * Add credits to user account
 */
export const addCredits = async (
  userId: string,
  amount: number,
  type: CreditTransactionType,
  reason: string,
  referenceId?: string
): Promise<{ success: boolean; newBalance: number; transactionId?: string }> => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }
      
      const newBalance = user.credits + amount;
      
      await tx.user.update({
        where: { id: userId },
        data: { credits: newBalance }
      });
      
      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          reason,
          balanceAfter: newBalance,
          referenceId
        }
      });
      
      return { newBalance, transactionId: transaction.id };
    });
    
    logger.info({ userId, amount, type, newBalance: result.newBalance }, 'Credits added');
    return { success: true, ...result };
  } catch (error) {
    logger.error({ err: error, userId, amount }, 'Failed to add credits');
    return { success: false, newBalance: 0 };
  }
};

/**
 * Get user credit history
 */
export const getCreditHistory = async (userId: string, limit = 50) => {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
};

/**
 * Get user balance summary
 */
export const getBalanceSummary = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      dailyCreditsUsed: true,
      dailyCreditsLimit: true,
      lastCreditReset: true,
      status: true
    }
  });
  
  if (!user) return null;
  
  // Check if daily reset needed
  const now = new Date();
  const lastReset = new Date(user.lastCreditReset);
  const needsReset = now.toDateString() !== lastReset.toDateString();
  
  return {
    balance: user.credits,
    dailyUsed: needsReset ? 0 : user.dailyCreditsUsed,
    dailyLimit: user.dailyCreditsLimit,
    dailyRemaining: user.dailyCreditsLimit - (needsReset ? 0 : user.dailyCreditsUsed),
    status: user.status,
    pipelineCost: PIPELINE_COST
  };
};

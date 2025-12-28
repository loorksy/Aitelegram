import { UserRole, UserStatus, Prisma, CreditTransactionType, AgentRunStatus } from '@prisma/client';
import { prisma } from '../core/prisma';
import { logger } from '../utils/logger';
import { addCredits } from './credits.service';
import { auditUserAction, AuditAction, getAuditLogs } from './audit.service';

export interface UserFilters {
  status?: UserStatus;
  role?: UserRole;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all users with filters
 */
export const getUsers = async (filters: UserFilters) => {
  const where: Prisma.UserWhereInput = {};
  
  if (filters.status) where.status = filters.status;
  if (filters.role) where.role = filters.role;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { username: { contains: filters.search, mode: 'insensitive' } },
      { telegramId: { contains: filters.search } }
    ];
  }
  
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      select: {
        id: true,
        name: true,
        username: true,
        telegramId: true,
        role: true,
        status: true,
        credits: true,
        dailyCreditsUsed: true,
        dailyCreditsLimit: true,
        approvedAt: true,
        approvedBy: true,
        deniedAt: true,
        deniedReason: true,
        createdAt: true,
        _count: {
          select: { bots: true, agentRuns: true }
        }
      }
    }),
    prisma.user.count({ where })
  ]);
  
  return { users, total };
};

/**
 * Get user by ID with full details
 */
export const getUserById = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: { bots: true, agentRuns: true, payments: true }
      }
    }
  });
};

/**
 * Approve a user
 */
export const approveUser = async (
  userId: string,
  approvedBy: string,
  initialCredits = 100
): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    if (user.status === UserStatus.APPROVED) {
      return { success: false, error: 'User already approved' };
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy,
        credits: initialCredits,
        deniedAt: null,
        deniedReason: null
      }
    });
    
    // Record initial credits
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: initialCredits,
        type: CreditTransactionType.ADMIN_ADJUSTMENT,
        reason: 'initial_credits_on_approval',
        balanceAfter: initialCredits
      }
    });
    
    // Audit log
    await auditUserAction(AuditAction.USER_APPROVED, approvedBy, userId, {
      initialCredits,
      previousStatus: user.status
    });
    
    logger.info({ userId, approvedBy, initialCredits }, 'User approved');
    return { success: true };
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to approve user');
    return { success: false, error: 'Failed to approve user' };
  }
};

/**
 * Deny a user
 */
export const denyUser = async (
  userId: string,
  deniedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DENIED,
        deniedAt: new Date(),
        deniedReason: reason ?? `Denied by admin`,
        approvedAt: null,
        approvedBy: null
      }
    });
    
    // Audit log
    await auditUserAction(AuditAction.USER_DENIED, deniedBy, userId, {
      reason,
      previousStatus: user.status
    });
    
    logger.info({ userId, deniedBy, reason }, 'User denied');
    return { success: true };
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to deny user');
    return { success: false, error: 'Failed to deny user' };
  }
};

/**
 * Set user credits
 */
export const setUserCredits = async (
  userId: string,
  credits: number,
  adjustedBy: string,
  reason?: string
): Promise<{ success: boolean; previousBalance?: number; newBalance?: number; error?: string }> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    const previousBalance = user.credits;
    const diff = credits - previousBalance;
    
    await prisma.user.update({
      where: { id: userId },
      data: { credits }
    });
    
    // Record adjustment
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: diff,
        type: CreditTransactionType.ADMIN_ADJUSTMENT,
        reason: reason ?? `Admin adjustment by ${adjustedBy}`,
        balanceAfter: credits
      }
    });
    
    // Audit log
    await auditUserAction(AuditAction.USER_CREDITS_SET, adjustedBy, userId, {
      previousBalance,
      newBalance: credits,
      diff,
      reason
    });
    
    logger.info({ userId, previousBalance, newBalance: credits, adjustedBy }, 'User credits set');
    return { success: true, previousBalance, newBalance: credits };
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to set user credits');
    return { success: false, error: 'Failed to set user credits' };
  }
};

/**
 * Set user daily limit
 */
export const setUserDailyLimit = async (
  userId: string,
  dailyLimit: number,
  adjustedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyCreditsLimit: dailyLimit }
    });
    
    logger.info({ userId, dailyLimit, adjustedBy }, 'User daily limit set');
    return { success: true };
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to set user daily limit');
    return { success: false, error: 'Failed to set daily limit' };
  }
};

/**
 * Set user role
 */
export const setUserRole = async (
  userId: string,
  role: UserRole,
  changedBy: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role }
    });
    
    logger.info({ userId, role, changedBy }, 'User role changed');
    return { success: true };
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to set user role');
    return { success: false, error: 'Failed to set role' };
  }
};

/**
 * Get agent runs with filters
 */
export const getAgentRuns = async (options: {
  userId?: string;
  status?: AgentRunStatus;
  limit?: number;
  offset?: number;
}) => {
  const where: Prisma.AgentRunWhereInput = {};
  if (options.userId) where.userId = options.userId;
  if (options.status) where.status = options.status;
  
  const [runs, total] = await Promise.all([
    prisma.agentRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
      include: {
        user: { select: { id: true, name: true, username: true, telegramId: true } }
      }
    }),
    prisma.agentRun.count({ where })
  ]);
  
  return { runs, total };
};

/**
 * Get system statistics
 */
export const getSystemStats = async () => {
  const [
    totalUsers,
    pendingUsers,
    approvedUsers,
    totalBots,
    totalRuns,
    successfulRuns,
    totalPayments,
    paidPayments
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: UserStatus.PENDING_APPROVAL } }),
    prisma.user.count({ where: { status: UserStatus.APPROVED } }),
    prisma.bot.count(),
    prisma.agentRun.count(),
    prisma.agentRun.count({ where: { status: 'SUCCESS' } }),
    prisma.payment.count(),
    prisma.payment.count({ where: { status: 'PAID' } })
  ]);
  
  return {
    users: { total: totalUsers, pending: pendingUsers, approved: approvedUsers },
    bots: { total: totalBots },
    runs: { total: totalRuns, successful: successfulRuns },
    payments: { total: totalPayments, paid: paidPayments }
  };
};

// Re-export audit functions for convenience
export { getAuditLogs, AuditAction } from './audit.service';

import { prisma } from '../core/prisma';
import { logger } from '../utils/logger';

export enum AuditAction {
  // User actions
  USER_CREATED = 'USER_CREATED',
  USER_APPROVED = 'USER_APPROVED',
  USER_DENIED = 'USER_DENIED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_CREDITS_SET = 'USER_CREDITS_SET',
  USER_DAILY_LIMIT_SET = 'USER_DAILY_LIMIT_SET',
  
  // Payment actions
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUNDED = 'PAYMENT_REFUNDED',
  
  // Bot actions
  BOT_CREATED = 'BOT_CREATED',
  BOT_PUBLISHED = 'BOT_PUBLISHED',
  BOT_DELETED = 'BOT_DELETED',
  
  // Pipeline actions
  PIPELINE_RUN = 'PIPELINE_RUN',
  PIPELINE_BLOCKED = 'PIPELINE_BLOCKED',
  
  // Admin actions
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_SETTINGS_CHANGED = 'ADMIN_SETTINGS_CHANGED'
}

export interface AuditLogEntry {
  action: AuditAction;
  actorId?: string; // User who performed the action
  targetId?: string; // Target user/entity
  targetType?: string; // 'USER', 'BOT', 'PAYMENT', etc.
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export const createAuditLog = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        targetId: entry.targetId,
        targetType: entry.targetType,
        details: entry.details ?? {},
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent
      }
    });
    
    logger.info(
      { action: entry.action, actorId: entry.actorId, targetId: entry.targetId },
      'Audit log created'
    );
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    logger.error({ err: error, entry }, 'Failed to create audit log');
  }
};

/**
 * Get audit logs with filters
 */
export const getAuditLogs = async (options: {
  action?: AuditAction;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) => {
  const where: any = {};
  
  if (options.action) where.action = options.action;
  if (options.actorId) where.actorId = options.actorId;
  if (options.targetId) where.targetId = options.targetId;
  if (options.targetType) where.targetType = options.targetType;
  
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }
  
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 100,
      skip: options.offset ?? 0
    }),
    prisma.auditLog.count({ where })
  ]);
  
  return { logs, total };
};

/**
 * Helper to create audit log for admin user actions
 */
export const auditUserAction = async (
  action: AuditAction,
  actorId: string,
  targetUserId: string,
  details?: Record<string, any>
) => {
  await createAuditLog({
    action,
    actorId,
    targetId: targetUserId,
    targetType: 'USER',
    details
  });
};

/**
 * Helper to create audit log for payment actions
 */
export const auditPaymentAction = async (
  action: AuditAction,
  userId: string,
  paymentId: string,
  details?: Record<string, any>
) => {
  await createAuditLog({
    action,
    actorId: userId,
    targetId: paymentId,
    targetType: 'PAYMENT',
    details
  });
};

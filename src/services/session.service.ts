import { Prisma, SessionState } from '@prisma/client';
import { prisma } from '../core/prisma';
import { logger } from '../utils/logger';

export const getSession = async (userId: string, botId?: string, chatId?: string) => {
  return prisma.session.findFirst({
    where: { userId, botId, chatId },
    orderBy: { updatedAt: 'desc' }
  });
};

/**
 * Get or create session with proper user foreign key handling
 * CRITICAL: The userId must be a valid User.id (UUID), not telegramId
 */
export const getOrCreateSession = async (userId: string, botId?: string, chatId?: string) => {
  // First try to find existing session
  const existing = await getSession(userId, botId, chatId);
  if (existing) {
    return existing;
  }

  // Before creating session, verify user exists
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  // If userId is actually a telegramId (numeric string), find the real user
  let actualUserId = userId;
  if (!userExists) {
    const userByTelegramId = await prisma.user.findUnique({
      where: { telegramId: userId },
      select: { id: true }
    });
    
    if (userByTelegramId) {
      actualUserId = userByTelegramId.id;
      logger.debug({ telegramId: userId, userId: actualUserId }, 'Resolved telegramId to userId');
    } else {
      // User doesn't exist at all - create them first
      logger.warn({ userId }, 'User not found, creating new user for session');
      const newUser = await prisma.user.create({
        data: {
          telegramId: userId,
          name: 'User'
        }
      });
      actualUserId = newUser.id;
    }
  }

  // Now create session with valid user ID
  try {
    return await prisma.session.create({
      data: {
        userId: actualUserId,
        botId,
        chatId,
        state: SessionState.USER_FLOW,
        data: { stack: [] } as Prisma.InputJsonValue
      }
    });
  } catch (error) {
    logger.error({ error, userId: actualUserId, botId, chatId }, 'Failed to create session');
    throw error;
  }
};

export const updateSession = async (
  sessionId: string,
  state: SessionState,
  data?: Record<string, unknown>
) => {
  return prisma.session.update({
    where: { id: sessionId },
    data: { state, data: data as Prisma.InputJsonValue }
  });
};

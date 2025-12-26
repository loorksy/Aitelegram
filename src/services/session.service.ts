import { Prisma, SessionState } from '@prisma/client';
import { prisma } from '../core/prisma';

export const getSession = async (userId: string, botId?: string, chatId?: string) => {
  return prisma.session.findFirst({
    where: { userId, botId, chatId },
    orderBy: { updatedAt: 'desc' }
  });
};

export const getOrCreateSession = async (userId: string, botId?: string, chatId?: string) => {
  const existing = await getSession(userId, botId, chatId);
  if (existing) {
    return existing;
  }

  return prisma.session.create({
    data: {
      userId,
      botId,
      chatId,
      state: SessionState.USER_FLOW,
      data: { stack: [] } as Prisma.InputJsonValue
    }
  });
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

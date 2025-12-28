import { Prisma } from '@prisma/client';
import { prisma } from '../core/prisma';

export const loadUserMemory = async (userId: string) => {
  return prisma.userMemory.findUnique({ where: { userId } });
};

export const saveUserMemory = async (userId: string, preferences: Record<string, unknown>) => {
  return prisma.userMemory.upsert({
    where: { userId },
    update: { preferences: preferences as Prisma.InputJsonValue },
    create: { userId, preferences: preferences as Prisma.InputJsonValue }
  });
};

export const loadBotMemory = async (botId: string) => {
  return prisma.botMemory.findUnique({ where: { botId } });
};

export const saveBotMemory = async (botId: string, profile: Record<string, unknown>) => {
  return prisma.botMemory.upsert({
    where: { botId },
    update: { profile: profile as Prisma.InputJsonValue },
    create: { botId, profile: profile as Prisma.InputJsonValue }
  });
};

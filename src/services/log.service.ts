import { Prisma } from '@prisma/client';
import { prisma } from '../core/prisma';

export const createLog = async (
  botId: string,
  level: string,
  message: string,
  meta?: Record<string, unknown>
) => {
  return prisma.log.create({
    data: { botId, level, message, meta: meta as Prisma.InputJsonValue }
  });
};

export const listRecentLogs = async (botId: string, limit = 20) => {
  return prisma.log.findMany({
    where: { botId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
};

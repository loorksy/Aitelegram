import { prisma } from '../core/prisma';

export const getActiveFlow = async (botId: string) => {
  return prisma.flow.findFirst({
    where: { botId },
    orderBy: { version: 'desc' }
  });
};

export const getDraftFlow = async (botId: string) => {
  return prisma.flow.findFirst({
    where: { botId, status: 'DRAFT' },
    orderBy: { version: 'desc' }
  });
};

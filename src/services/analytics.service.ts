import { InteractionType } from '@prisma/client';
import { prisma } from '../core/prisma';

export const recordInteraction = async (data: {
  botId: string;
  userId: string;
  type: InteractionType;
  nodeId?: string;
}) => {
  return prisma.userInteraction.create({
    data: {
      botId: data.botId,
      userId: data.userId,
      type: data.type,
      nodeId: data.nodeId
    }
  });
};

export const aggregateDailyAnalytics = async (date: Date) => {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const bots = await prisma.bot.findMany({ select: { id: true } });

  for (const bot of bots) {
    const interactions = await prisma.userInteraction.groupBy({
      by: ['type'],
      where: {
        botId: bot.id,
        createdAt: { gte: dayStart, lt: dayEnd }
      },
      _count: { _all: true }
    });

    const startCount = interactions.find((i) => i.type === InteractionType.START)?._count._all ?? 0;
    const clickCount = interactions.find((i) => i.type === InteractionType.BUTTON_CLICK)?._count._all ?? 0;
    const menuViews = interactions.find((i) => i.type === InteractionType.MENU_VIEW)?._count._all ?? 0;

    await prisma.botAnalytics.upsert({
      where: { botId_date: { botId: bot.id, date: dayStart } },
      update: { startCount, clickCount, menuViews },
      create: { botId: bot.id, date: dayStart, startCount, clickCount, menuViews }
    });
  }
};

export const getLast7DaysAnalytics = async (botId: string) => {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - 6);

  return prisma.botAnalytics.findMany({
    where: { botId, date: { gte: start } },
    orderBy: { date: 'asc' }
  });
};

export const exportAnalyticsCsv = async (botId: string) => {
  const records = await getLast7DaysAnalytics(botId);
  const header = 'date,startCount,clickCount,menuViews';
  const rows = records.map((row) => {
    const date = row.date.toISOString().split('T')[0];
    return `${date},${row.startCount},${row.clickCount},${row.menuViews}`;
  });
  return [header, ...rows].join('\n');
};

import { BotStatus, Prisma } from '@prisma/client';
import { prisma } from '../core/prisma';
import { decrypt } from '../core/encryption';
import { enqueueDirectNotification } from '../jobs/notificationQueue';

export const getBotWithToken = async (botId: string) => {
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { flows: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 } }
  });

  if (!bot) {
    return null;
  }

  if (!bot.tokenCipherText || !bot.tokenIv || !bot.tokenTag) {
    return { bot, token: null, flow: bot.flows[0] ?? null };
  }

  const token = decrypt(bot.tokenCipherText, bot.tokenIv, bot.tokenTag);

  return { bot, token, flow: bot.flows[0] ?? null };
};

export const updateBotStatus = async (botId: string, status: BotStatus) => {
  const bot = await prisma.bot.update({
    where: { id: botId },
    data: { status },
    include: { owner: true }
  });

  if (status === BotStatus.OFFLINE) {
    await enqueueDirectNotification({
      botId: bot.id,
      message: 'تم تحويل البوت إلى OFFLINE.',
      telegramId: bot.owner.telegramId
    });
  }

  return bot;
};

export const updateWelcomeText = async (botId: string, welcomeText: string) => {
  return prisma.bot.update({
    where: { id: botId },
    data: { welcomeText }
  });
};

export const updateMenuLabels = async (botId: string, menuLabels: unknown) => {
  return prisma.bot.update({
    where: { id: botId },
    data: { menuLabels: menuLabels as Prisma.InputJsonValue }
  });
};

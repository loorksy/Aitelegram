import { ModerationMode } from '@prisma/client';
import { prisma } from '../core/prisma';

export const linkGroupToBot = async (data: {
  botId: string;
  chatId: string;
  title?: string;
  moderationMode?: ModerationMode;
}) => {
  return prisma.botGroup.upsert({
    where: {
      botId_chatId: {
        botId: data.botId,
        chatId: data.chatId
      }
    },
    update: {
      title: data.title,
      moderationMode: data.moderationMode ?? ModerationMode.MANUAL
    },
    create: {
      botId: data.botId,
      chatId: data.chatId,
      title: data.title,
      moderationMode: data.moderationMode ?? ModerationMode.MANUAL
    }
  });
};

export const getGroupByChat = async (botId: string, chatId: string) => {
  return prisma.botGroup.findUnique({
    where: { botId_chatId: { botId, chatId } }
  });
};

export const updateModerationMode = async (
  groupId: string,
  moderationMode: ModerationMode
) => {
  return prisma.botGroup.update({
    where: { id: groupId },
    data: { moderationMode }
  });
};

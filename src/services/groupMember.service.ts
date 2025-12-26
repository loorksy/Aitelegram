import { prisma } from '../core/prisma';

export const getOrCreateGroupMember = async (groupId: string, telegramId: string) => {
  return prisma.groupMember.upsert({
    where: { groupId_telegramId: { groupId, telegramId } },
    update: {},
    create: { groupId, telegramId }
  });
};

export const incrementWarn = async (groupId: string, telegramId: string) => {
  const member = await getOrCreateGroupMember(groupId, telegramId);
  return prisma.groupMember.update({
    where: { id: member.id },
    data: { warns: { increment: 1 } }
  });
};

export const markBanned = async (groupId: string, telegramId: string) => {
  const member = await getOrCreateGroupMember(groupId, telegramId);
  return prisma.groupMember.update({
    where: { id: member.id },
    data: { banned: true }
  });
};

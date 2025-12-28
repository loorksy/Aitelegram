import { NotificationStatus, Prisma } from '@prisma/client';
import { prisma } from '../core/prisma';

export const createNotification = async (data: {
  botId: string;
  message: string;
  target: unknown;
  scheduledAt?: Date;
}) => {
  const status = data.scheduledAt ? NotificationStatus.SCHEDULED : NotificationStatus.PENDING;
  return prisma.notification.create({
    data: { ...data, status, target: data.target as Prisma.InputJsonValue }
  });
};

export const updateNotificationStatus = async (
  id: string,
  status: NotificationStatus
) => {
  return prisma.notification.update({
    where: { id },
    data: { status }
  });
};

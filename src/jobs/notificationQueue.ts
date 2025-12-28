import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { getBotWithToken } from '../services/bot.service';
import { sendMessage } from '../core/telegram';
import { prisma } from '../core/prisma';
import { NotificationStatus } from '@prisma/client';
import { updateNotificationStatus } from '../services/notification.service';

const connection = { url: env.REDIS_URL };

export const notificationSendQueue = new Queue('notification-send', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 }
  }
});

export const notificationBatchQueue = new Queue('notification-batch', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  }
});

export const enqueueBroadcast = async ({
  botId,
  message,
  scheduledAt,
  notificationId
}: {
  botId: string;
  message: string;
  scheduledAt?: Date;
  notificationId: string;
}) => {
  const delay = scheduledAt ? scheduledAt.getTime() - Date.now() : 0;
  return notificationBatchQueue.add(
    'broadcast',
    { botId, message, notificationId },
    delay > 0 ? { delay } : undefined
  );
};

export const enqueueDirectNotification = async ({
  botId,
  message,
  telegramId
}: {
  botId: string;
  message: string;
  telegramId: string;
}) => {
  return notificationSendQueue.add('send', {
    botId,
    message,
    telegramId
  });
};

export const startNotificationWorkers = () => {
  new Worker(
    'notification-batch',
    async (job) => {
      const { botId, message, notificationId } = job.data as {
        botId: string;
        message: string;
        notificationId: string;
      };

      const sessions = await prisma.session.findMany({
        where: { botId },
        include: { user: true }
      });

      const recipients = Array.from(
        new Set(sessions.map((session) => session.user.telegramId))
      );

      for (const telegramId of recipients) {
        await notificationSendQueue.add('send', {
          botId,
          message,
          telegramId
        });
      }

      await updateNotificationStatus(notificationId, NotificationStatus.SENT);
    },
    { connection }
  );

  new Worker(
    'notification-send',
    async (job) => {
      const { botId, message, telegramId } = job.data as {
        botId: string;
        message: string;
        telegramId: string;
      };
      const result = await getBotWithToken(botId);
      if (!result?.token) {
        return;
      }
      await sendMessage(result.token, Number(telegramId), message);
    },
    { connection, concurrency: 5, limiter: { max: 30, duration: 1000 } }
  );
};

import fs from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../core/prisma';

export const getBotStorageUsage = async (botId: string) => {
  const result = await prisma.media.aggregate({
    where: { botId },
    _sum: { sizeMB: true }
  });

  return result._sum.sizeMB ?? 0;
};

export const createMedia = async (data: {
  botId: string;
  type: string;
  filePath: string;
  mimeType: string;
  sizeMB: number;
  uploadedBy: string;
  nodeIds?: unknown;
}) => {
  return prisma.media.create({
    data: { ...data, nodeIds: data.nodeIds as Prisma.InputJsonValue }
  });
};

export const getMediaById = async (mediaId: string) => {
  return prisma.media.findUnique({ where: { id: mediaId } });
};

export const incrementUsage = async (mediaId: string) => {
  return prisma.media.update({
    where: { id: mediaId },
    data: { usageCount: { increment: 1 } }
  });
};

export const cleanupUnusedMedia = async (days: number) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const stale = await prisma.media.findMany({
    where: {
      usageCount: 0,
      createdAt: { lt: cutoff }
    }
  });

  for (const item of stale) {
    try {
      await fs.unlink(path.resolve(item.filePath));
    } catch {
      // ignore missing files
    }
  }

  await prisma.media.deleteMany({
    where: {
      id: { in: stale.map((item) => item.id) }
    }
  });

  return stale.length;
};

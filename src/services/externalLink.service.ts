import { prisma } from '../core/prisma';

export const createLink = async (data: {
  botId: string;
  nodeId: string;
  type: string;
  label: string;
  url: string;
  webAppUrl?: string;
  loginUrl?: string;
}) => {
  return prisma.externalLink.create({ data });
};

export const listLinks = async (botId: string, nodeId?: string) => {
  return prisma.externalLink.findMany({
    where: { botId, nodeId }
  });
};

export const getLinkById = async (id: string) => {
  return prisma.externalLink.findUnique({ where: { id } });
};

export const updateLink = async (
  id: string,
  data: Partial<{
    type: string;
    label: string;
    url: string;
    webAppUrl?: string;
    loginUrl?: string;
    isActive: boolean;
  }>
) => {
  return prisma.externalLink.update({ where: { id }, data });
};

export const deleteLink = async (id: string) => {
  return prisma.externalLink.delete({ where: { id } });
};

export const incrementClick = async (id: string) => {
  return prisma.externalLink.update({
    where: { id },
    data: { clickCount: { increment: 1 } }
  });
};

export const listAllLinks = async () => {
  return prisma.externalLink.findMany({ where: { isActive: true } });
};

import { Request, Response, NextFunction } from 'express';
import {
  createLink,
  deleteLink,
  incrementClick,
  listLinks,
  updateLink
} from '../services/externalLink.service';

export const createLinkHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { botId, nodeId, type, label, url, webAppUrl, loginUrl } = req.body;
    if (!botId || !nodeId || !type || !label || !url) {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }
    const link = await createLink({
      botId,
      nodeId,
      type,
      label,
      url,
      webAppUrl,
      loginUrl
    });
    return res.json({ ok: true, link });
  } catch (error) {
    return next(error);
  }
};

export const listLinksHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const botId = req.query.botId as string;
    const nodeId = req.query.nodeId as string | undefined;
    if (!botId) {
      return res.status(400).json({ ok: false, error: 'botId is required' });
    }
    const links = await listLinks(botId, nodeId);
    return res.json({ ok: true, links });
  } catch (error) {
    return next(error);
  }
};

export const updateLinkHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const link = await updateLink(id, req.body);
    return res.json({ ok: true, link });
  } catch (error) {
    return next(error);
  }
};

export const deleteLinkHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await deleteLink(id);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};

export const clickLinkHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await incrementClick(id);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};

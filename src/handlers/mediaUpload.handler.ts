import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env';
import { createMedia, getBotStorageUsage } from '../services/media.service';

const storageRoot = '/app/storage';

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const botId = req.body.botId as string;
      if (!botId) {
        return cb(new Error('botId is required'), storageRoot);
      }
      const dir = path.join(storageRoot, botId);
      await fs.mkdir(dir, { recursive: true });
      return cb(null, dir);
    } catch (error) {
      return cb(error as Error, storageRoot);
    }
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: env.MEDIA_MAX_FILE_MB * 1024 * 1024 }
}).single('file');

const resolveType = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return 'photo';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return 'document';
};

export const mediaUploadHandler = (req: Request, res: Response, next: NextFunction) => {
  upload(req as any, res as any, async (err: any) => {
    try {
      if (err) {
        return res.status(400).json({ ok: false, error: err.message });
      }

      const botId = req.body.botId as string;
      const uploadedBy = (req.body.uploadedBy as string) ?? 'owner';
      if (!botId) {
        return res.status(400).json({ ok: false, error: 'botId is required' });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'file is required' });
      }

      const currentUsage = await getBotStorageUsage(botId);
      const sizeMB = req.file.size / (1024 * 1024);

      if (currentUsage + sizeMB > env.STORAGE_MAX_SIZE_MB) {
        await fs.unlink(req.file.path);
        return res.status(400).json({
          ok: false,
          error: 'Storage limit exceeded'
        });
      }

      const media = await createMedia({
        botId,
        type: resolveType(req.file.mimetype),
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        sizeMB,
        uploadedBy,
        nodeIds: []
      });

      return res.json({ ok: true, media });
    } catch (error) {
      return next(error);
    }
  });
};

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../core/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// JWT secret - should be in env
const JWT_SECRET = env.ENCRYPTION_KEY || 'default-jwt-secret-change-in-production';
const JWT_ACCESS_EXPIRY = '1h';
const JWT_REFRESH_EXPIRY = '7d';

export interface JWTPayload {
  userId: string;
  telegramId: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload & { dbUser?: any };
}

/**
 * Generate JWT tokens
 */
export const generateTokens = (payload: JWTPayload) => {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRY });
  const refreshToken = jwt.sign({ userId: payload.userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY
  });
  
  return { accessToken, refreshToken };
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
};

/**
 * Authentication middleware
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Fetch fresh user data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        telegramId: true,
        role: true,
        status: true,
        name: true,
        username: true,
        credits: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = {
      userId: user.id,
      telegramId: user.telegramId,
      role: user.role,
      status: user.status,
      dbUser: user
    };
    
    next();
  } catch (error) {
    logger.error({ err: error }, 'Authentication error');
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.userId, role: req.user.role, required: allowedRoles },
        'Access denied - insufficient role'
      );
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * Require approved status
 */
export const requireApproved = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (req.user.status !== UserStatus.APPROVED) {
    return res.status(403).json({
      error: 'Account not approved',
      status: req.user.status,
      message: req.user.status === UserStatus.PENDING_APPROVAL
        ? 'Your account is pending approval. Please wait for admin approval.'
        : 'Your account access has been restricted.'
    });
  }
  
  next();
};

/**
 * Optional authentication (doesn't fail if no token)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    
    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          telegramId: true,
          role: true,
          status: true,
          name: true,
          username: true,
          credits: true
        }
      });
      
      if (user) {
        req.user = {
          userId: user.id,
          telegramId: user.telegramId,
          role: user.role,
          status: user.status,
          dbUser: user
        };
      }
    }
  }
  
  next();
};

/**
 * Create token for user (used after Telegram auth)
 */
export const createUserToken = async (telegramId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: any;
} | null> => {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: {
      id: true,
      telegramId: true,
      role: true,
      status: true,
      name: true,
      username: true,
      credits: true
    }
  });
  
  if (!user) return null;
  
  const tokens = generateTokens({
    userId: user.id,
    telegramId: user.telegramId,
    role: user.role,
    status: user.status
  });
  
  return { ...tokens, user };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<{
  accessToken: string;
  user: any;
} | null> => {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string; type: string };
    
    if (payload.type !== 'refresh') return null;
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        telegramId: true,
        role: true,
        status: true,
        name: true,
        username: true,
        credits: true
      }
    });
    
    if (!user) return null;
    
    const accessToken = jwt.sign(
      {
        userId: user.id,
        telegramId: user.telegramId,
        role: user.role,
        status: user.status
      },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRY }
    );
    
    return { accessToken, user };
  } catch {
    return null;
  }
};

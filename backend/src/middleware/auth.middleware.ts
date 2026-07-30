import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';
import type { AuthUser } from '../shared/types/express.js';
import { cacheService } from '../services/cache/index.js';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: AuthUser['role'];
  email: string;
  iat?: number;
  exp?: number;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication token required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Check if token has been blacklisted upon logout
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isBlacklisted = await cacheService.exists(`blacklist_token:${tokenHash}`);
    if (isBlacklisted) {
      res.status(401).json({ success: false, message: 'Authentication token has been revoked' });
      return;
    }

    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      role: decoded.role,
      email: decoded.email,
    };
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token' });
  }
}

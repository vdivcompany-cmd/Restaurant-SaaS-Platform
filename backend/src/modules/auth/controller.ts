import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './service.js';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
} from './validation.js';

export class AuthController {
  private static extractBearerToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    return undefined;
  }

  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RegisterSchema.parse(req.body);
      const result = await AuthService.register(validated);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = LoginSchema.parse(req.body);
      const result = await AuthService.login(validated);
      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RefreshTokenSchema.parse(req.body);
      const tokens = await AuthService.refreshTokens(validated.refreshToken);
      res.json({
        success: true,
        data: { tokens },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = AuthController.extractBearerToken(req);
      if (req.user) {
        await AuthService.logout(req.user.id, token);
      }
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.tenantId) {
        res.status(401).json({ success: false, message: 'Authentication context required' });
        return;
      }
      const token = AuthController.extractBearerToken(req);
      const validated = ChangePasswordSchema.parse(req.body);
      await AuthService.changePassword(req.user.id, req.tenantId, validated, token);
      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

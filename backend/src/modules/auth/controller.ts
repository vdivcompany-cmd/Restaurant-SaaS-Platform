import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './service.js';
import env from '../../config/env.js';
import {
  RegisterSuperAdminSchema,
  RegisterOwnerSchema,
  RegisterStaffSchema,
  LoginSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
} from './validation.js';

export class AuthController {
  private static extractToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    return req.cookies?.access_token as string | undefined;
  }

  private static setAuthCookies(res: Response, accessToken: string, refreshToken?: string): void {
    const isProd = env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    if (refreshToken) {
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
  }

  private static clearAuthCookies(res: Response): void {
    const isProd = env.NODE_ENV === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
    });
  }

  public static async registerSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RegisterSuperAdminSchema.parse(req.body);
      const result = await AuthService.registerSuperAdmin(validated);
      AuthController.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async registerOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RegisterOwnerSchema.parse(req.body);
      const result = await AuthService.registerOwner(validated.tenantId, validated);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async registerStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tenantId = req.tenantId || req.user?.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant ID is required to register staff' });
        return;
      }
      const validated = RegisterStaffSchema.parse(req.body);
      const result = await AuthService.registerStaff(tenantId, validated);
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
      AuthController.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
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
      const refreshTokenInput = req.body?.refreshToken || req.cookies?.refresh_token;
      const validated = RefreshTokenSchema.parse({ refreshToken: refreshTokenInput });
      const tokens = await AuthService.refreshTokens(validated.refreshToken);
      AuthController.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
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
      const token = AuthController.extractToken(req);
      if (req.user) {
        await AuthService.logout(req.user.id, token);
      }
      AuthController.clearAuthCookies(res);
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
      const token = AuthController.extractToken(req);
      const validated = ChangePasswordSchema.parse(req.body);
      await AuthService.changePassword(req.user.id, req.tenantId, validated, token);
      AuthController.clearAuthCookies(res);
      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}


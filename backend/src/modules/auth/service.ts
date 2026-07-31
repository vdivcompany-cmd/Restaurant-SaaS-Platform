import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRepository } from './repository.js';
import { TenantRepository } from '../tenants/repository.js';
import { cacheService } from '../../services/cache/index.js';
import env from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import type {
  RegisterSuperAdminInput,
  RegisterOwnerInput,
  RegisterStaffInput,
  LoginInput,
  ChangePasswordInput,
} from './validation.js';
import type { AuthUser } from '../../shared/types/express.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: {
    id: string;
    tenantId?: string | undefined;
    email: string;
    role: AuthUser['role'];
    phone?: string;
  };
  tokens: TokenPair;
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class AuthService {
  private static generateTokens(userId: string, tenantId: string | null | undefined, role: AuthUser['role'], email: string): TokenPair {
    const payload = { userId, role, email, ...(tenantId ? { tenantId } : {}) };
    const accessToken = jwt.sign(
      payload,
      env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshPayload = { userId, type: 'refresh', ...(tenantId ? { tenantId } : {}) };
    const refreshToken = jwt.sign(
      refreshPayload,
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  /**
   * Session Model Design Note:
   * Uses single-session-per-user cache key (`refresh_token:${userId}`).
   * Logging in on a new device rotates and overwrites the active refresh token for that user,
   * invalidating the previous device's refresh token session upon next refresh attempt.
   */
  private static getRefreshCacheKey(userId: string): string {
    return `refresh_token:${userId}`;
  }

  /**
   * Public registration endpoint specifically for provisioning platform Super Admins (for testing).
   */
  public static async registerSuperAdmin(data: RegisterSuperAdminInput): Promise<AuthResponse> {
    return this.createSuperAdmin(data);
  }

  /**
   * Protected endpoint called by Platform Super Admin to create the first owner for a tenant.
   */
  public static async registerOwner(tenantId: string, data: Omit<RegisterOwnerInput, 'tenantId'>): Promise<AuthResponse> {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new AppError('Tenant ID is required', 400);
    }

    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const existingUser = await UserRepository.findByEmail(tenantId, data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists in tenant', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const userDocData = {
      email: data.email.toLowerCase(),
      passwordHash,
      role: 'owner' as const,
      isActive: true,
      ...(data.phone ? { phone: data.phone } : {}),
    };

    const user = await UserRepository.create(tenantId, userDocData);

    const tokens = this.generateTokens(
      user._id.toString(),
      tenantId,
      user.role,
      user.email
    );

    await cacheService.set(
      this.getRefreshCacheKey(user._id.toString()),
      tokens.refreshToken,
      REFRESH_TOKEN_EXPIRY_SECONDS
    );

    return {
      user: {
        id: user._id.toString(),
        tenantId,
        email: user.email,
        role: user.role,
        ...(user.phone ? { phone: user.phone } : {}),
      },
      tokens,
    };
  }

  /**
   * Protected endpoint called by Owner / Manager / Super Admin to invite staff to a tenant.
   */
  public static async registerStaff(tenantId: string, data: RegisterStaffInput): Promise<AuthResponse> {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new AppError('Tenant ID is required for staff accounts', 400);
    }

    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const existingUser = await UserRepository.findByEmail(tenantId, data.email);
    if (existingUser) {
      throw new AppError('User with this email already exists in tenant', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const userDocData = {
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      isActive: true,
      ...(data.phone ? { phone: data.phone } : {}),
    };

    const user = await UserRepository.create(tenantId, userDocData);

    const tokens = this.generateTokens(
      user._id.toString(),
      tenantId,
      user.role,
      user.email
    );

    await cacheService.set(
      this.getRefreshCacheKey(user._id.toString()),
      tokens.refreshToken,
      REFRESH_TOKEN_EXPIRY_SECONDS
    );

    return {
      user: {
        id: user._id.toString(),
        tenantId,
        email: user.email,
        role: user.role,
        ...(user.phone ? { phone: user.phone } : {}),
      },
      tokens,
    };
  }

  /**
   * Helper specifically for provisioning platform super administrators.
   */
  public static async createSuperAdmin(data: {
    tenantId?: string | null | undefined;
    email: string;
    password: string;
    phone?: string | undefined;
  }): Promise<AuthResponse> {
    const existingUser = await UserRepository.findSuperAdminByEmail(data.email);
    if (existingUser) {
      throw new AppError('Super Admin already exists with this email', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const userDocData = {
      email: data.email.toLowerCase(),
      passwordHash,
      role: 'super_admin' as const,
      isActive: true,
      ...(data.phone ? { phone: data.phone } : {}),
    };

    const user = await UserRepository.create(data.tenantId || null, userDocData);

    const tokens = this.generateTokens(
      user._id.toString(),
      user.tenantId ? user.tenantId.toString() : null,
      user.role,
      user.email
    );

    await cacheService.set(
      this.getRefreshCacheKey(user._id.toString()),
      tokens.refreshToken,
      REFRESH_TOKEN_EXPIRY_SECONDS
    );

    return {
      user: {
        id: user._id.toString(),
        ...(user.tenantId ? { tenantId: user.tenantId.toString() } : {}),
        email: user.email,
        role: user.role,
        ...(user.phone ? { phone: user.phone } : {}),
      },
      tokens,
    };
  }

  public static async login(data: LoginInput): Promise<AuthResponse> {
    let tenantId = data.tenantId;

    if (!tenantId && data.tenantSlug) {
      const tenant = await TenantRepository.findBySlug(data.tenantSlug);
      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }
      tenantId = tenant._id.toString();
    }

    if (!tenantId) {
      // Check for global platform Super Admin login
      const superAdmin = await UserRepository.findSuperAdminByEmail(data.email);
      if (superAdmin) {
        if (!superAdmin.isActive) {
          throw new AppError('User account is deactivated', 403);
        }
        const isMatch = await bcrypt.compare(data.password, superAdmin.passwordHash);
        if (!isMatch) {
          throw new AppError('Invalid credentials', 401);
        }
        superAdmin.lastLoginAt = new Date();
        await UserRepository.save(superAdmin);
        const tokens = this.generateTokens(
          superAdmin._id.toString(),
          superAdmin.tenantId ? superAdmin.tenantId.toString() : null,
          superAdmin.role,
          superAdmin.email
        );
        await cacheService.set(
          this.getRefreshCacheKey(superAdmin._id.toString()),
          tokens.refreshToken,
          REFRESH_TOKEN_EXPIRY_SECONDS
        );
        return {
          user: {
            id: superAdmin._id.toString(),
            ...(superAdmin.tenantId ? { tenantId: superAdmin.tenantId.toString() } : {}),
            email: superAdmin.email,
            role: superAdmin.role,
            ...(superAdmin.phone ? { phone: superAdmin.phone } : {}),
          },
          tokens,
        };
      }

      throw new AppError('Either tenantId or tenantSlug must be provided for restaurant accounts', 400);
    }

    const user = await UserRepository.findByEmail(tenantId, data.email);
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) {
      throw new AppError('User account is deactivated', 403);
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    user.lastLoginAt = new Date();
    await UserRepository.save(user);

    const tokens = this.generateTokens(
      user._id.toString(),
      tenantId,
      user.role,
      user.email
    );

    await cacheService.set(
      this.getRefreshCacheKey(user._id.toString()),
      tokens.refreshToken,
      REFRESH_TOKEN_EXPIRY_SECONDS
    );

    return {
      user: {
        id: user._id.toString(),
        tenantId,
        email: user.email,
        role: user.role,
        ...(user.phone ? { phone: user.phone } : {}),
      },
      tokens,
    };
  }

  public static async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
        userId: string;
        tenantId: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401);
      }

      const storedToken = await cacheService.get<string>(this.getRefreshCacheKey(decoded.userId));
      if (!storedToken || storedToken !== refreshToken) {
        throw new AppError('Refresh token invalid or expired', 401);
      }

      const user = await UserRepository.findById(decoded.tenantId, decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError('User not found or inactive', 401);
      }

      const newTokens = this.generateTokens(
        user._id.toString(),
        decoded.tenantId,
        user.role,
        user.email
      );

      await cacheService.set(
        this.getRefreshCacheKey(user._id.toString()),
        newTokens.refreshToken,
        REFRESH_TOKEN_EXPIRY_SECONDS
      );

      return newTokens;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  public static async logout(userId: string, accessToken?: string): Promise<void> {
    // 1. Invalidate refresh token
    await cacheService.del(this.getRefreshCacheKey(userId));

    // 2. Blacklist access token for its remaining lifespan
    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken) as { exp?: number } | null;
        if (decoded?.exp) {
          const now = Math.floor(Date.now() / 1000);
          const remainingTtl = decoded.exp - now;
          if (remainingTtl > 0) {
            const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
            await cacheService.set(`blacklist_token:${tokenHash}`, 'revoked', remainingTtl);
          }
        }
      } catch {
        // Ignore decode errors
      }
    }
  }

  public static async changePassword(
    userId: string,
    tenantId: string,
    data: ChangePasswordInput,
    accessToken?: string
  ): Promise<void> {
    const user = await UserRepository.findById(tenantId, userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isMatch = await bcrypt.compare(data.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400);
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(data.newPassword, salt);
    await UserRepository.save(user);

    await this.logout(userId, accessToken);
  }
}

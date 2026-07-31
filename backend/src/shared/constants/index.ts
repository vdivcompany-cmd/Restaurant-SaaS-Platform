/**
 * Master Application Constants Reference
 * Centralizing all system-wide enum strings, default configurations, and SLA tiers.
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  KITCHEN: 'kitchen',
  TABLE: 'table',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_VALUES = Object.values(ROLES);

export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];
export const SUBSCRIPTION_PLAN_VALUES = Object.values(SUBSCRIPTION_PLANS);

export const SUBSCRIPTION_STATUSES = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export const ORDER_STATUSES = {
  RECEIVED: 'received',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];
export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUSES);

export const ORDER_TYPES = {
  DINE_IN: 'dine-in',
  TAKEAWAY: 'takeaway',
  DELIVERY: 'delivery',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  ONLINE: 'online',
} as const;

export const DEFAULT_TENANT_SETTINGS = {
  currency: 'EGP',
  timezone: 'Africa/Cairo',
  language: 'ar',
} as const;

export const TOKEN_EXPIRATION = {
  ACCESS_TOKEN_MINUTES: 15,
  REFRESH_TOKEN_DAYS: 7,
  TABLE_QR_TOKEN_HOURS: 24,
} as const;

export const API_RATE_LIMIT_QUOTAS = {
  free: 120,      // requests per minute
  starter: 300,   // requests per minute
  pro: 1200,      // requests per minute
  enterprise: 5000, // requests per minute
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  TENANT_ISOLATION_BREach: 'TENANT_ISOLATION_BREACH',
} as const;

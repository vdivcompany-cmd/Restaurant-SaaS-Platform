import { TenantRepository } from './repository.js';
import type { ITenant } from './model.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import type { CreateTenantInput, UpdateTenantSettingsInput } from './validation.js';

export class TenantService {
  public static async createTenant(data: CreateTenantInput): Promise<ITenant> {
    const existing = await TenantRepository.findBySlug(data.slug);
    if (existing) {
      throw new AppError('A tenant with this slug already exists', 409);
    }

    const defaultSettings = {
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      language: 'ar' as const,
    };

    const tenant = await TenantRepository.create({
      name: data.name,
      slug: data.slug.toLowerCase(),
      contact: data.contact,
      settings: data.settings ? { ...defaultSettings, ...data.settings } : defaultSettings,
      status: 'trial',
      subscriptionPlan: 'free',
    });

    return tenant;
  }

  public static async getTenantById(id: string): Promise<ITenant> {
    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }
    return tenant;
  }

  public static async getTenantBySlug(slug: string): Promise<ITenant> {
    const tenant = await TenantRepository.findBySlug(slug);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }
    return tenant;
  }

  public static async updateTenantSettings(id: string, data: UpdateTenantSettingsInput): Promise<ITenant> {
    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (data.name) tenant.name = data.name;
    if (data.contact) {
      if (data.contact.phone) tenant.contact.phone = data.contact.phone;
      if (data.contact.email) tenant.contact.email = data.contact.email;
    }
    if (data.settings) {
      if (data.settings.currency) tenant.settings.currency = data.settings.currency;
      if (data.settings.timezone) tenant.settings.timezone = data.settings.timezone;
      if (data.settings.language) tenant.settings.language = data.settings.language;
    }

    return TenantRepository.save(tenant);
  }
}

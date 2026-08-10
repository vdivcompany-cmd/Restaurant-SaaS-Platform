import { TenantRepository } from './repository.js';
import { SubscriptionRepository } from '../subscriptions/repository.js';
import { BranchRepository } from '../branches/repository.js';
import { eventBus } from '../../shared/events/index.js';
import { withTransactionOrFallback } from '../../utils/withTransactionOrFallback.js';
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

    const branchRepo = new BranchRepository();

    const tenant = await withTransactionOrFallback(async (session) => {
      const createdTenant = await TenantRepository.create({
        name: data.name,
        slug: data.slug.toLowerCase(),
        brandName: data.name,
        contact: data.contact,
        settings: data.settings ? { ...defaultSettings, ...data.settings } : defaultSettings,
        status: 'trial',
        subscriptionPlan: 'free',
        qrRedirectUrl: 'https://t.me/resturanchatbot',
        isOpen: true,
        isChatbotActive: true,
      }, session);

      await SubscriptionRepository.create(createdTenant._id.toString(), {
        plan: 'free',
        status: 'trialing',
      }, session);

      // Auto-provision a default branch so a new tenant always has somewhere to attach
      // tables/products/orders without a manual extra step.
      await branchRepo.create(createdTenant._id.toString(), {
        name: `${data.name} - Main Branch`,
        slug: 'main',
        address: 'Address not set — update in branch settings',
        phone: data.contact.phone,
        isActive: true,
        tableCount: 0,
      }, session);

      return createdTenant;
    });

    // Emit domain event so listeners (e.g., Zero-to-Value auto-seeding worker) can react
    eventBus.emitEvent('tenant.created', {
      tenantId: tenant._id.toString(),
      slug: tenant.slug,
      name: tenant.name,
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

    if (data.name !== undefined) tenant.name = data.name;
    if (data.contact) {
      if (data.contact.phone !== undefined) tenant.contact.phone = data.contact.phone;
      if (data.contact.email !== undefined) tenant.contact.email = data.contact.email;
    }
    if (data.settings) {
      if (data.settings.currency !== undefined) tenant.settings.currency = data.settings.currency;
      if (data.settings.timezone !== undefined) tenant.settings.timezone = data.settings.timezone;
      if (data.settings.language !== undefined) tenant.settings.language = data.settings.language;
    }

    return TenantRepository.save(tenant);
  }

  public static async upsertProfile(tenantId: string, dto: import('./validation.js').RestaurantProfileDto): Promise<ITenant> {
    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (dto.brandName !== undefined) tenant.brandName = dto.brandName;
    if (dto.cuisineType !== undefined) tenant.cuisineType = dto.cuisineType;
    if (dto.description !== undefined) tenant.description = dto.description;
    if (dto.logoUrl !== undefined) tenant.logoUrl = dto.logoUrl;
    if (dto.qrRedirectUrl !== undefined) tenant.qrRedirectUrl = dto.qrRedirectUrl;
    if (dto.currency !== undefined) {
      tenant.settings = tenant.settings || { currency: 'EGP', timezone: 'Africa/Cairo', language: 'ar' };
      tenant.settings.currency = dto.currency;
    }
    if (dto.isOpen !== undefined) tenant.isOpen = dto.isOpen;
    if (dto.isChatbotActive !== undefined) tenant.isChatbotActive = dto.isChatbotActive;
    if (dto.chatbotSettings) {
      tenant.chatbotSettings = {
        ...tenant.chatbotSettings,
        ...dto.chatbotSettings,
      };
    }

    return TenantRepository.save(tenant);
  }

  public static async getProfile(tenantId: string): Promise<ITenant> {
    return this.getTenantById(tenantId);
  }

  public static async getAiStatus(tenantId: string) {
    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) throw new AppError('Tenant profile not found for this tenant', 404);

    const isOpen = tenant.isOpen !== false;
    const isChatbotActive = tenant.isChatbotActive !== false;
    const canAnswer = isOpen && isChatbotActive;
    const offlineReply = tenant.chatbotSettings?.offlineMessage || 'We are currently closed for orders or our chatbot is on a break. Please check back during operating hours!';

    return {
      tenantId,
      brandName: tenant.brandName || tenant.name,
      currency: tenant.settings?.currency || 'EGP',
      isOpen,
      isChatbotActive,
      canAnswer,
      offlineReply: canAnswer ? null : offlineReply,
      aiModelPreference: tenant.chatbotSettings?.aiModelPreference || 'gpt-4o',
    };
  }

  public static async getTenantBranchInfo(tenantId: string, branchId: string) {
    const tenant = await TenantRepository.findById(tenantId);
    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const branchRepo = new BranchRepository();
    const branch = await branchRepo.findById(tenantId, branchId);
    if (!branch) {
      throw new AppError('Branch not found or out of scope', 404);
    }

    return {
      tenant: {
        id: tenant._id.toString(),
        name: tenant.name,
        brandName: tenant.brandName || tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl,
        cuisineType: tenant.cuisineType,
        description: tenant.description,
        currency: tenant.settings?.currency || 'EGP',
        timezone: tenant.settings?.timezone || 'Africa/Cairo',
        language: tenant.settings?.language || 'ar',
        isOpen: tenant.isOpen !== false,
        isChatbotActive: tenant.isChatbotActive !== false,
        contact: tenant.contact,
      },
      branch: {
        id: branch._id.toString(),
        name: branch.name,
        slug: branch.slug,
        address: branch.address,
        phone: branch.phone,
        isActive: branch.isActive,
        tableCount: branch.tableCount,
      },
    };
  }
}

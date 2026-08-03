import { type Model, type ProjectionType, type PipelineStage, Types } from 'mongoose';

/**
 * Tenant Scoped Query Helper — MANDATORY for all Mongoose queries across modules.
 * Rule #1: Every query MUST include tenantId.
 */

export class TenantScopeError extends Error {
  constructor(message: string = 'TenantId is required for database operations') {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/**
 * Ensures valid tenantId is provided before building filter.
 */
function scopeFilter(tenantId: string | undefined, filter: any = {}): any {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new TenantScopeError('TenantId scope missing or invalid. Query blocked for security.');
  }
  return { ...(filter || {}), tenantId };
}

export const tenantQuery = {
  find<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any = {},
    projection?: ProjectionType<T>,
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, filter);
    return model.find(scoped, projection, options);
  },

  findOne<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any = {},
    projection?: ProjectionType<T>,
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, filter);
    return model.findOne(scoped, projection, options);
  },

  findById<T>(
    model: Model<T>,
    tenantId: string | undefined,
    id: string,
    projection?: ProjectionType<T>,
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, { _id: id });
    return model.findOne(scoped, projection, options);
  },

  findOneAndUpdate<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any,
    update: any,
    options?: any
  ): any {
    const scoped = scopeFilter(tenantId, filter);
    return model.findOneAndUpdate(scoped, update, options);
  },

  updateOne<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any,
    update: any,
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, filter);
    return model.updateOne(scoped, update, options);
  },

  updateMany<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any,
    update: any,
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, filter);
    return model.updateMany(scoped, update, options);
  },

  deleteOne<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any,
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, filter);
    return model.deleteOne(scoped, options);
  },

  deleteMany<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any,
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, filter);
    return model.deleteMany(scoped, options);
  },

  countDocuments<T>(
    model: Model<T>,
    tenantId: string | undefined,
    filter: any = {},
    options?: any
  ) {
    const scoped = scopeFilter(tenantId, filter);
    return model.countDocuments(scoped, options);
  },

  aggregate<T>(
    model: Model<T>,
    tenantId: string | undefined,
    pipeline: PipelineStage[] = []
  ) {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new TenantScopeError('TenantId scope missing for aggregation.');
    }
    const matchVal = Types.ObjectId.isValid(tenantId) ? new Types.ObjectId(tenantId) : tenantId;
    const tenantMatch: PipelineStage = { $match: { tenantId: matchVal } };
    return model.aggregate<T>([tenantMatch, ...pipeline]);
  },

  create<T>(
    model: Model<T>,
    tenantId: string | undefined,
    docData: any
  ) {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new TenantScopeError('TenantId scope missing for document creation.');
    }
    return model.create({ ...docData, tenantId });
  }
};

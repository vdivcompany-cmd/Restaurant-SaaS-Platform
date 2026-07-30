import { type Request, type Response } from 'express';

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses and validates pagination parameters from the query string.
 *
 * Clamps limit to MAX_LIMIT to prevent clients from requesting
 * unbounded result sets.
 */
export function parsePagination(query: PaginationQuery): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(query.page ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(query.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Builds a standard paginated API response body.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Sends a standard paginated JSON response.
 * Convenience wrapper for use in controllers.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
): Response {
  return res.json(buildPaginatedResponse(data, total, page, limit));
}

/**
 * Middleware that parses `?page=` and `?limit=` and attaches
 * `req.pagination` for downstream use in controllers.
 */
export function paginationMiddleware() {
  return (req: Request & { pagination?: ReturnType<typeof parsePagination> }, _res: Response, next: () => void): void => {
    req.pagination = parsePagination(req.query as PaginationQuery);
    next();
  };
}

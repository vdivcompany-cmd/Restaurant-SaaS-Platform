import type { Request, Response, NextFunction } from 'express';
import { vectorSyncService } from './sync.service.js';
import { searchQuerySchema, sessionSearchSchema } from './validation.js';
import { chatSessionService } from '../chat-sessions/service.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

/**
 * Authenticated tenant-scoped search. For staff / owner UI / debugging.
 * GET /api/v1/vector/search?q=...&topK=5
 */
export async function vectorSearchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const { q, topK } = searchQuerySchema.parse(req.query);
    const results = await vectorSyncService.searchProducts(tenantId, q, { topK });
    res.status(200).json({ success: true, data: { query: q, topK, results } });
  } catch (err) {
    next(err);
  }
}

/**
 * Public session-scoped search. For chatbots (Telegram bot, web widget).
 * Tenant is derived from the chat session — no auth header needed, the sessionId
 * itself is the trust anchor (it's an unguessable UUID that only lives as long
 * as the table session).
 * POST /api/v1/chat-sessions/search  body: { sessionId, query, topK? }
 */
export async function sessionSearchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = sessionSearchSchema.parse(req.body);
    const session = await chatSessionService.getSession(dto.sessionId);
    if (!session) throw new AppError('Chat session expired or invalid', 404);

    const opts: { topK?: number } = {};
    if (dto.topK !== undefined) opts.topK = dto.topK;
    const results = await vectorSyncService.searchProducts(session.tenantId, dto.query, opts);

    res.status(200).json({
      success: true,
      data: { query: dto.query, tenantId: session.tenantId, results },
    });
  } catch (err) {
    next(err);
  }
}

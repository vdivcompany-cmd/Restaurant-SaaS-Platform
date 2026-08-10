import type { Request, Response, NextFunction } from 'express';
import { chatSessionService } from './service.js';
import {
  resolveSessionSchema,
  byChannelQuerySchema,
  closeSessionSchema,
  saveTableBindingSchema,
} from './validation.js';

export async function resolveSessionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = resolveSessionSchema.parse(req.body);
    const session = await chatSessionService.resolveAndBind(dto.token, dto.channel, dto.channelUserId);
    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function getByChannelHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = byChannelQuerySchema.parse(req.query);
    const session = await chatSessionService.getByChannel(query.channel, query.channelUserId);
    if (!session) {
      res.status(404).json({ success: false, message: 'No active session for this channel user' });
      return;
    }
    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function closeSessionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = closeSessionSchema.parse(req.body);
    await chatSessionService.closeSession(dto.sessionId);
    res.status(200).json({ success: true, message: 'Session closed' });
  } catch (err) {
    next(err);
  }
}

export async function saveTableBindingHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = saveTableBindingSchema.parse(req.body);
    const binding = await chatSessionService.saveTableBinding(dto.chatId, dto.tableId, dto.tenantId, dto.tableSessionId);
    res.status(200).json({ success: true, data: binding });
  } catch (err) {
    next(err);
  }
}

export async function getTableContextHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const chatId = String(req.params['chatId'] ?? '');
    const binding = await chatSessionService.getTableBinding(chatId);
    if (!binding) {
      res.status(404).json({ success: false, message: 'No table context bound for this chat' });
      return;
    }
    res.status(200).json({ success: true, data: binding });
  } catch (err) {
    next(err);
  }
}

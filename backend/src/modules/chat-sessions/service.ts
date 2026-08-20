import crypto from 'node:crypto';
import { cacheService } from '../../services/cache/index.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import { TableModel } from '../tables/model.js';
import type { ChannelName } from '../channels/index.js';
import type { ChatSession, ChannelBinding, TableBinding } from './model.js';

const SESSION_TTL_SECONDS = 90 * 60;    // 90 min — matches TableService
const SHORT_TOKEN_TTL_SECONDS = 15 * 60; // 15 min — one-shot bootstrap
const BINDING_TTL_SECONDS = 90 * 60;
export const TABLE_BINDING_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — survives the whole dining visit (or longer)

const sessionKey = (sessionId: string) => `chat_session:${sessionId}`;
const shortTokenKey = (token: string) => `scan_token:${token}`;
const bindingKey = (channel: ChannelName, channelUserId: string) =>
  `chat_binding:${channel}:${channelUserId}`;
const tableBindingKey = (chatId: string) => `table_binding:telegram:${chatId}`;

export class ChatSessionService {
  /**
   * Create a chat session from a resolved QR scan.
   * Returns the sessionId and a short opaque bootstrap token that a channel
   * (Telegram start payload, web ?s= param) uses to look up context.
   */
  public async createFromQrResolution(input: {
    tenantId: string;
    branchId: string;
    tableId: string;
    tableNumber: number;
    sessionId?: string;
  }): Promise<{ session: ChatSession; shortToken: string }> {
    const session: ChatSession = {
      sessionId: input.sessionId ?? crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      tableId: input.tableId,
      tableNumber: input.tableNumber,
      startedAt: Date.now(),
    };

    await cacheService.set(sessionKey(session.sessionId), session, SESSION_TTL_SECONDS);

    const shortToken = crypto.randomBytes(12).toString('base64url'); // 16 chars, well under Telegram's 64
    await cacheService.set(shortTokenKey(shortToken), { sessionId: session.sessionId }, SHORT_TOKEN_TTL_SECONDS);

    return { session, shortToken };
  }

  public async getSession(sessionId: string): Promise<ChatSession | null> {
    return await cacheService.get<ChatSession>(sessionKey(sessionId));
  }

  /**
   * Bootstrap step called by the bot / web frontend on first contact.
   * Consumes the short token, binds the given channel user to the session,
   * and returns the full session context.
   */
  public async resolveAndBind(
    token: string,
    channel: ChannelName,
    channelUserId?: string
  ): Promise<ChatSession & { chatId: string }> {
    const ptr = await cacheService.get<{ sessionId: string }>(shortTokenKey(token));
    if (!ptr) throw new AppError('Invalid or expired scan token', 404);

    const session = await this.getSession(ptr.sessionId);
    if (!session) throw new AppError('Chat session expired', 404);

    // For web channel: mint a secure, server-side chatId
    // For telegram: use the Telegram-provided chat ID
    const chatId = channel === 'web'
      ? `web_${crypto.randomBytes(8).toString('base64url')}`
      : (channelUserId || `web_${crypto.randomBytes(8).toString('base64url')}`);

    const binding: ChannelBinding = {
      sessionId: session.sessionId,
      channel,
      channelUserId: chatId,
      boundAt: Date.now(),
    };
    await cacheService.set(bindingKey(channel, chatId), binding, BINDING_TTL_SECONDS);

    // Short token is single-use — drop it after successful bind.
    await cacheService.del(shortTokenKey(token));

    return { ...session, chatId };
  }

  /**
   * Look up the active session for a channel user (e.g. Telegram chat.id).
   * Used by the bot on every subsequent message.
   */
  public async getByChannel(
    channel: ChannelName,
    channelUserId: string
  ): Promise<ChatSession | null> {
    const binding = await cacheService.get<ChannelBinding>(bindingKey(channel, channelUserId));
    if (!binding) return null;
    return await this.getSession(binding.sessionId);
  }

  public async closeSession(sessionId: string): Promise<void> {
    await cacheService.del(sessionKey(sessionId));
    // Bindings will expire on their own TTL; no reverse index needed for MVP.
  }

  /**
   * Permanently associates a Telegram chatId with a table/tenant, once, when a
   * customer scans the table QR code. n8n calls this so it never has to manage
   * sessionId UUIDs itself — every subsequent message just looks up by chatId.
   */
  public async saveTableBinding(
    chatId: string,
    tableId: string,
    tenantIdHint?: string,
    tableSessionId?: string, 
  ): Promise<TableBinding> {
    const table = tenantIdHint
      ? await TableModel.findOne({ _id: tableId, tenantId: tenantIdHint })
      : await TableModel.findById(tableId);

    if (!table) throw new AppError('Table not found', 404);

    const binding: TableBinding = {
      tenantId: table.tenantId.toString(),
      branchId: table.branchId.toString(),
      tableId: table._id.toString(),
      tableNumber: table.number,
      ...(tableSessionId ? { tableSessionId } : {}),
      boundAt: Date.now(),
    };

    await cacheService.set(tableBindingKey(chatId), binding, TABLE_BINDING_TTL_SECONDS);
    return binding;
  }

  /**
   * Looks up the table bound to a Telegram chatId. Used by n8n on every
   * incoming message to recover tenant/table context without a sessionId.
   */
  public async getTableBinding(chatId: string): Promise<TableBinding | null> {
    return await cacheService.get<TableBinding>(tableBindingKey(chatId));
  }
}

export const chatSessionService = new ChatSessionService();

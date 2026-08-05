import crypto from 'node:crypto';
import { cacheService } from '../../services/cache/index.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import type { ChannelName } from '../channels/index.js';
import type { ChatSession, ChannelBinding } from './model.js';

const SESSION_TTL_SECONDS = 90 * 60;    // 90 min — matches TableService
const SHORT_TOKEN_TTL_SECONDS = 15 * 60; // 15 min — one-shot bootstrap
const BINDING_TTL_SECONDS = 90 * 60;

const sessionKey = (sessionId: string) => `chat_session:${sessionId}`;
const shortTokenKey = (token: string) => `scan_token:${token}`;
const bindingKey = (channel: ChannelName, channelUserId: string) =>
  `chat_binding:${channel}:${channelUserId}`;

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
    channelUserId: string
  ): Promise<ChatSession> {
    const ptr = await cacheService.get<{ sessionId: string }>(shortTokenKey(token));
    if (!ptr) throw new AppError('Invalid or expired scan token', 404);

    const session = await this.getSession(ptr.sessionId);
    if (!session) throw new AppError('Chat session expired', 404);

    const binding: ChannelBinding = {
      sessionId: session.sessionId,
      channel,
      channelUserId,
      boundAt: Date.now(),
    };
    await cacheService.set(bindingKey(channel, channelUserId), binding, BINDING_TTL_SECONDS);

    // Short token is single-use — drop it after successful bind.
    await cacheService.del(shortTokenKey(token));

    return session;
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
}

export const chatSessionService = new ChatSessionService();

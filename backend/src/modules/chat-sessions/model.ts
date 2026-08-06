import type { ChannelName } from '../channels/index.js';

export interface ChatSession {
  sessionId: string;
  tenantId: string;
  branchId: string;
  tableId: string;
  tableNumber: number;
  customerId?: string;
  startedAt: number;
}

export interface ChannelBinding {
  sessionId: string;
  channel: ChannelName;
  channelUserId: string;
  boundAt: number;
}

/**
 * Long-lived Telegram chatId -> table association for the n8n bot workflow.
 * Distinct from ChannelBinding: this survives the whole dining visit (or
 * longer) rather than the short QR-scan bootstrap window, and is keyed
 * directly by chatId since that's all the bot has on every incoming update.
 */
export interface TableBinding {
  tenantId: string;
  branchId: string;
  tableId: string;
  tableNumber: number;
  boundAt: number;
}

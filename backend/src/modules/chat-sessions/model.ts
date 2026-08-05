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

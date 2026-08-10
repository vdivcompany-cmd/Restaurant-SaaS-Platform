export type ChannelName = 'telegram' | 'web';

export interface ChannelRedirectContext {
  shortToken: string;
  tenantId: string;
  branchId: string;
  tableId: string;
  tableNumber: number;
  sessionId: string;
  redirectBase: string;
}

export interface ChannelAdapter {
  readonly name: ChannelName;
  detect(redirectBase: string): boolean;
  buildRedirectUrl(ctx: ChannelRedirectContext): string;
}

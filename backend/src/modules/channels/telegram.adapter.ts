import type { ChannelAdapter, ChannelRedirectContext, ChannelName } from './adapter.interface.js';

const TELEGRAM_START_MAX = 64;

export class TelegramAdapter implements ChannelAdapter {
  public readonly name: ChannelName = 'telegram';

  public detect(redirectBase: string): boolean {
    return redirectBase.includes('t.me/') || redirectBase.includes('telegram.me/');
  }

  public buildRedirectUrl(ctx: ChannelRedirectContext): string {
    if (ctx.shortToken.length > TELEGRAM_START_MAX) {
      throw new Error(`Telegram start payload exceeds ${TELEGRAM_START_MAX} chars`);
    }
    const base = ctx.redirectBase.split('?')[0];
    return `${base}?start=${ctx.shortToken}`;
  }
}

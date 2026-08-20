import type { ChannelAdapter, ChannelRedirectContext, ChannelName } from './adapter.interface.js';

export class WebAdapter implements ChannelAdapter {
  public readonly name: ChannelName = 'web';

  public detect(redirectBase: string): boolean {
    return /^https?:\/\//i.test(redirectBase);
  }

  public buildRedirectUrl(ctx: ChannelRedirectContext): string {
    try {
      const url = new URL(ctx.redirectBase);
      url.searchParams.set('token', ctx.shortToken);
      url.searchParams.set('s', ctx.shortToken);
      return url.toString();
    } catch {
      const sep = ctx.redirectBase.includes('?') ? '&' : '?';
      return `${ctx.redirectBase}${sep}token=${ctx.shortToken}&s=${ctx.shortToken}`;
    }
  }
}

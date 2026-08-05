import type { ChannelAdapter, ChannelName } from './adapter.interface.js';
import { TelegramAdapter } from './telegram.adapter.js';
import { WebAdapter } from './web.adapter.js';

export * from './adapter.interface.js';
export { TelegramAdapter, WebAdapter };

const telegram = new TelegramAdapter();
const web = new WebAdapter();

const registry: Record<ChannelName, ChannelAdapter> = {
  telegram,
  web,
};

export function getAdapter(channel: ChannelName): ChannelAdapter {
  return registry[channel];
}

/**
 * Infer the channel from a redirect URL. Telegram takes priority because
 * t.me/telegram.me links are still valid http(s) URLs.
 */
export function resolveAdapter(redirectBase: string): ChannelAdapter {
  if (telegram.detect(redirectBase)) return telegram;
  return web;
}

import { registerAs } from '@nestjs/config';

export const telegramConfig = registerAs('telegram', () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID ?? '',
  apiBase: process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org',
  requestTimeoutMs: parseInt(process.env.TELEGRAM_TIMEOUT_MS ?? '5000', 10),
}));

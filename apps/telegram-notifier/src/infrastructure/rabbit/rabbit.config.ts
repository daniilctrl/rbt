import { registerAs } from '@nestjs/config';

export const rabbitConfig = registerAs('rabbit', () => ({
  url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',

  notificationsExchange: process.env.NOTIFICATIONS_EXCHANGE ?? 'notifications.exchange',
  telegramQueue: process.env.NOTIFICATIONS_TELEGRAM_QUEUE ?? 'notifications.telegram.q',
  retryQueue: process.env.NOTIFICATIONS_RETRY_QUEUE ?? 'notifications.retry.q',
  dlx: process.env.NOTIFICATIONS_DLX ?? 'notifications.dlx',
  dlq: process.env.NOTIFICATIONS_DLQ ?? 'notifications.dlq.parking',

  retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS ?? '3', 10),
  retryTtlMs: parseInt(process.env.RETRY_TTL_MS ?? '2000', 10),
}));

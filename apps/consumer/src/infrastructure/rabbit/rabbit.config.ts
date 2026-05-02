import { registerAs } from '@nestjs/config';

export const rabbitConfig = registerAs('rabbit', () => ({
  url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',

  // events.* (вход)
  eventsExchange: process.env.EVENTS_EXCHANGE ?? 'events.exchange',
  eventsQueue: process.env.EVENTS_QUEUE ?? 'events.q',
  eventsRetryQueue: process.env.EVENTS_RETRY_QUEUE ?? 'events.retry.q',
  eventsDlx: process.env.EVENTS_DLX ?? 'events.dlx',
  eventsDlq: process.env.EVENTS_DLQ ?? 'events.dlq.parking',

  // notifications.* (выход)
  notificationsExchange: process.env.NOTIFICATIONS_EXCHANGE ?? 'notifications.exchange',

  // retry-параметры
  retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS ?? '3', 10),
  retryTtlMs: parseInt(process.env.RETRY_TTL_MS ?? '2000', 10),

  // дефолтный chat_id для уведомлений (если в событии не указан)
  defaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID ?? '',
}));

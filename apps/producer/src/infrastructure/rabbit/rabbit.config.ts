import { registerAs } from '@nestjs/config';

export const rabbitConfig = registerAs('rabbit', () => ({
  url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  exchange: process.env.EVENTS_EXCHANGE ?? 'events.exchange',
  publishRetries: parseInt(process.env.PUBLISH_RETRIES ?? '3', 10),
}));

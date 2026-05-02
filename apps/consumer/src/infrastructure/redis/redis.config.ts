import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  ttlSeconds: parseInt(process.env.IDEMPOTENCY_TTL_SECONDS ?? '86400', 10),
}));

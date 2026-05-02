import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { redisConfig } from './redis.config';
import { RedisIdempotencyStoreAdapter } from './redis-idempotency-store.adapter';
import { IDEMPOTENCY_STORE } from '../../application/ports/idempotency-store.port';

@Module({
  imports: [ConfigModule.forFeature(redisConfig)],
  providers: [
    RedisIdempotencyStoreAdapter,
    { provide: IDEMPOTENCY_STORE, useExisting: RedisIdempotencyStoreAdapter },
  ],
  exports: [IDEMPOTENCY_STORE],
})
export class RedisModule {}

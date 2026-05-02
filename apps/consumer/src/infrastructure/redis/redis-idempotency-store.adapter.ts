import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { IdempotencyStorePort } from '../../application/ports/idempotency-store.port';
import { redisConfig } from './redis.config';

@Injectable()
export class RedisIdempotencyStoreAdapter implements IdempotencyStorePort, OnModuleDestroy {
  private readonly logger = new Logger(RedisIdempotencyStoreAdapter.name);
  private readonly client: Redis;

  constructor(@Inject(redisConfig.KEY) private readonly cfg: ConfigType<typeof redisConfig>) {
    this.client = new Redis({
      host: cfg.host,
      port: cfg.port,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    this.client.on('error', (err) => this.logger.error({ msg: 'redis error', error: err.message }));
  }

  /**
   * Атомарно: если ключа нет — поставить его с TTL и вернуть true (свежий).
   * Если есть — вернуть false (дубликат).
   *
   * Это и есть стандартный приём «idempotency key» через Redis SET NX.
   */
  async markIfFresh(eventId: string): Promise<boolean> {
    const key = `idem:event:${eventId}`;
    // SET key value NX EX <seconds>
    const result = await this.client.set(key, '1', 'EX', this.cfg.ttlSeconds, 'NX');
    return result === 'OK';
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

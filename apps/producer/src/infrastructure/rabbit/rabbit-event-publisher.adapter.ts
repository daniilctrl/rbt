import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import pRetry from 'p-retry';
import { DomainEvent, MessageHeaders } from '@app/contracts';
import {
  EventPublisherPort,
  PublishFailedError,
} from '../../application/ports/event-publisher.port';
import { rabbitConfig } from './rabbit.config';

@Injectable()
export class RabbitEventPublisherAdapter implements EventPublisherPort {
  private readonly logger = new Logger(RabbitEventPublisherAdapter.name);

  constructor(
    private readonly amqp: AmqpConnection,
    @Inject(rabbitConfig.KEY)
    private readonly cfg: ConfigType<typeof rabbitConfig>,
  ) {}

  async publish<T>(routingKey: string, event: DomainEvent<T>): Promise<void> {
    try {
      await pRetry(
        async () => {
          // publish() с включёнными publisher confirms (см. RabbitMQModule.forRoot:
          // connectionInitOptions.wait = true; channels.confirm = true).
          // Промис резолвится только после ack от брокера.
          const ok = await this.amqp.publish(this.cfg.exchange, routingKey, event, {
            persistent: true,
            messageId: event.eventId,
            timestamp: Math.floor(Date.now() / 1000),
            headers: {
              [MessageHeaders.CorrelationId]: event.correlationId,
            },
          });

          if (!ok) {
            // amqp-connection-manager возвращает false если соединение не готово.
            // pRetry увидит throw и сделает следующую попытку.
            throw new Error('publish returned false (channel not ready)');
          }
        },
        {
          retries: this.cfg.publishRetries,
          minTimeout: 200,
          factor: 2,
          onFailedAttempt: (err) => {
            this.logger.warn({
              msg: 'publish attempt failed, will retry',
              attempt: err.attemptNumber,
              retriesLeft: err.retriesLeft,
              error: err.message,
              eventId: event.eventId,
            });
          },
        },
      );
    } catch (err) {
      this.logger.error({
        msg: 'publish failed after all retries',
        eventId: event.eventId,
        error: (err as Error).message,
      });
      throw new PublishFailedError(
        `Failed to publish event ${event.eventId} after retries`,
        err,
      );
    }
  }
}

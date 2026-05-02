import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import { DomainEvent, MessageHeaders } from '@app/contracts';
import { HandleEventUseCase } from '../../application/handle-event.use-case';
import { rabbitConfig } from './rabbit.config';

/**
 * Подписан на events.q с двумя routing keys:
 *   - event.created  — свежие события из Producer'а
 *   - event.retry    — события, которые отлежались в retry-queue после TTL
 *
 * При ошибке обработки сам решает: новый retry или parking.
 * Не бросает исключение наверх — иначе golevelup сделает requeue или DLX
 * по своим правилам, и контроль над ретраями уйдёт.
 */
@Injectable()
export class EventsConsumer {
  private readonly logger = new Logger(EventsConsumer.name);

  constructor(
    private readonly handler: HandleEventUseCase,
    private readonly amqp: AmqpConnection,
    @Inject(rabbitConfig.KEY) private readonly cfg: ConfigType<typeof rabbitConfig>,
  ) {}

  @RabbitSubscribe({
    exchange: process.env.EVENTS_EXCHANGE ?? 'events.exchange',
    routingKey: ['event.created', 'event.retry'],
    queue: process.env.EVENTS_QUEUE ?? 'events.q',
    queueOptions: {
      durable: true,
    },
    allowNonJsonMessages: false,
  })
  async handle(payload: DomainEvent<unknown>, amqpMsg: ConsumeMessage): Promise<void> {
    const headers = (amqpMsg.properties.headers ?? {}) as Record<string, unknown>;
    const retryCount = parseInt(String(headers[MessageHeaders.RetryCount] ?? '0'), 10);

    try {
      const result = await this.handler.execute(payload, this.cfg.defaultChatId);
      this.logger.debug({
        msg: 'handler returned',
        status: result.status,
        eventId: payload.eventId,
      });
      // Не выбрасываем — golevelup сделает ack автоматически
    } catch (err) {
      const error = err as Error;
      this.logger.error({
        msg: 'event handling failed — routing to retry/parking',
        eventId: payload.eventId,
        correlationId: payload.correlationId,
        retryCount,
        error: error.message,
      });

      await this.routeFailed(payload, retryCount, error.message);
      // Возвращаем void после ручной маршрутизации — текущее сообщение ack'ается
    }
  }

  private async routeFailed(
    event: DomainEvent<unknown>,
    currentRetry: number,
    reason: string,
  ): Promise<void> {
    const nextRetry = currentRetry + 1;
    const headers = {
      [MessageHeaders.CorrelationId]: event.correlationId,
      [MessageHeaders.RetryCount]: String(nextRetry),
      'x-failure-reason': reason,
    };

    if (nextRetry < this.cfg.retryMaxAttempts) {
      this.logger.warn({
        msg: 'scheduling retry',
        eventId: event.eventId,
        nextRetry,
        ttlMs: this.cfg.retryTtlMs,
      });
      await this.amqp.publish('', this.cfg.eventsRetryQueue, event, {
        persistent: true,
        messageId: event.eventId,
        headers,
      });
    } else {
      this.logger.error({
        msg: 'parking event in DLQ — manual intervention needed',
        eventId: event.eventId,
        attempts: nextRetry,
      });
      await this.amqp.publish('', this.cfg.eventsDlq, event, {
        persistent: true,
        messageId: event.eventId,
        headers,
      });
    }
  }
}

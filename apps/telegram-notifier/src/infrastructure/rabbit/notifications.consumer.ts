import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AmqpConnection, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import { MessageHeaders, RoutingKeys, TelegramNotification } from '@app/contracts';
import { SendTelegramNotificationUseCase } from '../../application/send-telegram-notification.use-case';
import { TelegramPermanentError } from '../../application/ports/telegram-client.port';
import { rabbitConfig } from './rabbit.config';

@Injectable()
export class NotificationsConsumer {
  private readonly logger = new Logger(NotificationsConsumer.name);

  constructor(
    private readonly useCase: SendTelegramNotificationUseCase,
    private readonly amqp: AmqpConnection,
    @Inject(rabbitConfig.KEY) private readonly cfg: ConfigType<typeof rabbitConfig>,
  ) {}

  @RabbitSubscribe({
    exchange: process.env.NOTIFICATIONS_EXCHANGE ?? 'notifications.exchange',
    routingKey: [RoutingKeys.NotifyTelegram, 'notify.telegram.retry'],
    queue: process.env.NOTIFICATIONS_TELEGRAM_QUEUE ?? 'notifications.telegram.q',
    queueOptions: { durable: true },
    allowNonJsonMessages: false,
  })
  async handle(notification: TelegramNotification, amqpMsg: ConsumeMessage): Promise<void> {
    const headers = (amqpMsg.properties.headers ?? {}) as Record<string, unknown>;
    const retryCount = parseInt(String(headers[MessageHeaders.RetryCount] ?? '0'), 10);

    try {
      await this.useCase.execute(notification);
    } catch (err) {
      const error = err as Error;

      // Permanent errors (4xx) — нет смысла ретраить, сразу в parking
      if (err instanceof TelegramPermanentError) {
        this.logger.error({
          msg: 'permanent telegram error — parking immediately',
          notificationId: notification.notificationId,
          statusCode: err.statusCode,
          error: error.message,
        });
        await this.publishToParking(notification, retryCount, error.message);
        return;
      }

      this.logger.warn({
        msg: 'transient telegram error — routing to retry/parking',
        notificationId: notification.notificationId,
        retryCount,
        error: error.message,
      });
      await this.routeFailed(notification, retryCount, error.message);
    }
  }

  private async routeFailed(
    n: TelegramNotification,
    currentRetry: number,
    reason: string,
  ): Promise<void> {
    const nextRetry = currentRetry + 1;
    const headers = {
      [MessageHeaders.CorrelationId]: n.correlationId,
      [MessageHeaders.RetryCount]: String(nextRetry),
      'x-failure-reason': reason,
    };

    if (nextRetry < this.cfg.retryMaxAttempts) {
      await this.amqp.publish('', this.cfg.retryQueue, n, {
        persistent: true,
        messageId: n.notificationId,
        headers,
      });
    } else {
      await this.publishToParking(n, currentRetry, reason);
    }
  }

  private async publishToParking(
    n: TelegramNotification,
    retryCount: number,
    reason: string,
  ): Promise<void> {
    await this.amqp.publish('', this.cfg.dlq, n, {
      persistent: true,
      messageId: n.notificationId,
      headers: {
        [MessageHeaders.CorrelationId]: n.correlationId,
        [MessageHeaders.RetryCount]: String(retryCount),
        'x-failure-reason': reason,
      },
    });
  }
}

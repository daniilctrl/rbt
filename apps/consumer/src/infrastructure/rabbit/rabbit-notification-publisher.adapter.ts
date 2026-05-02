import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { MessageHeaders, RoutingKeys, TelegramNotification } from '@app/contracts';
import { NotificationPublisherPort } from '../../application/ports/notification-publisher.port';
import { rabbitConfig } from './rabbit.config';

@Injectable()
export class RabbitNotificationPublisherAdapter implements NotificationPublisherPort {
  private readonly logger = new Logger(RabbitNotificationPublisherAdapter.name);

  constructor(
    private readonly amqp: AmqpConnection,
    @Inject(rabbitConfig.KEY) private readonly cfg: ConfigType<typeof rabbitConfig>,
  ) {}

  async publish(notification: TelegramNotification): Promise<void> {
    const ok = await this.amqp.publish(
      this.cfg.notificationsExchange,
      RoutingKeys.NotifyTelegram,
      notification,
      {
        persistent: true,
        messageId: notification.notificationId,
        headers: {
          [MessageHeaders.CorrelationId]: notification.correlationId,
        },
      },
    );

    if (!ok) {
      throw new Error('notifications.exchange publish returned false');
    }

    this.logger.debug({
      msg: 'notification published',
      notificationId: notification.notificationId,
      causedByEventId: notification.causedByEventId,
    });
  }
}

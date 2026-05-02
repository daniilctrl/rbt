import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DomainEvent } from '@app/contracts';
import { NotificationFactory } from '../domain/notification.factory';
import { IDEMPOTENCY_STORE, IdempotencyStorePort } from './ports/idempotency-store.port';
import {
  NOTIFICATION_PUBLISHER,
  NotificationPublisherPort,
} from './ports/notification-publisher.port';

export interface HandleEventResult {
  status: 'processed' | 'duplicate';
  eventId: string;
}

@Injectable()
export class HandleEventUseCase {
  private readonly logger = new Logger(HandleEventUseCase.name);

  constructor(
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStorePort,
    @Inject(NOTIFICATION_PUBLISHER) private readonly notifications: NotificationPublisherPort,
  ) {}

  async execute(event: DomainEvent<unknown>, defaultChatId: string): Promise<HandleEventResult> {
    const isFresh = await this.idempotency.markIfFresh(event.eventId);
    if (!isFresh) {
      this.logger.warn({
        msg: 'duplicate event — skipping',
        eventId: event.eventId,
        correlationId: event.correlationId,
      });
      return { status: 'duplicate', eventId: event.eventId };
    }

    const notification = NotificationFactory.fromEvent(event, defaultChatId);
    await this.notifications.publish(notification);

    this.logger.log({
      msg: 'event processed and notification published',
      eventId: event.eventId,
      notificationId: notification.notificationId,
      correlationId: event.correlationId,
    });

    return { status: 'processed', eventId: event.eventId };
  }
}

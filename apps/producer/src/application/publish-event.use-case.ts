import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, RoutingKeys } from '@app/contracts';
import { EVENT_PUBLISHER, EventPublisherPort } from './ports/event-publisher.port';

export interface PublishEventInput<T> {
  eventType: string;
  payload: T;
  /** Опционально — позволяет вызывающему передать свой correlationId для трассировки */
  correlationId?: string;
  /** Опционально — позволяет переопределить routing key (по умолчанию event.created) */
  routingKey?: string;
}

export interface PublishEventResult {
  eventId: string;
  correlationId: string;
  occurredAt: string;
}

@Injectable()
export class PublishEventUseCase {
  private readonly logger = new Logger(PublishEventUseCase.name);

  constructor(
    @Inject(EVENT_PUBLISHER) private readonly publisher: EventPublisherPort,
  ) {}

  async execute<T>(input: PublishEventInput<T>): Promise<PublishEventResult> {
    const event: DomainEvent<T> = {
      eventId: uuidv4(),
      eventType: input.eventType,
      occurredAt: new Date().toISOString(),
      correlationId: input.correlationId ?? uuidv4(),
      payload: input.payload,
    };

    const routingKey = input.routingKey ?? RoutingKeys.EventCreated;

    this.logger.log({
      msg: 'publishing event',
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      routingKey,
    });

    await this.publisher.publish(routingKey, event);

    this.logger.log({
      msg: 'event published (confirmed by broker)',
      eventId: event.eventId,
      correlationId: event.correlationId,
    });

    return {
      eventId: event.eventId,
      correlationId: event.correlationId,
      occurredAt: event.occurredAt,
    };
  }
}

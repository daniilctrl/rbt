import type { DomainEvent } from '@app/contracts';

/**
 * Порт для публикации событий. Use-case зависит от этого интерфейса,
 * а не от конкретной реализации (RabbitMQ / Kafka / in-memory для тестов).
 *
 * publish() возвращает Promise<void>, который резолвится только после
 * подтверждения брокера (publisher confirm). При временных ошибках
 * соединения адаптер выполняет ретраи. При окончательной неудаче
 * выбрасывает PublishFailedError.
 */
export interface EventPublisherPort {
  publish<T>(routingKey: string, event: DomainEvent<T>): Promise<void>;
}

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export class PublishFailedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'PublishFailedError';
  }
}

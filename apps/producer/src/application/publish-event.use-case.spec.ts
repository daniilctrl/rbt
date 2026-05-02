import { Test } from '@nestjs/testing';
import { DomainEvent, RoutingKeys } from '@app/contracts';
import { PublishEventUseCase } from './publish-event.use-case';
import { EVENT_PUBLISHER, EventPublisherPort } from './ports/event-publisher.port';

describe('PublishEventUseCase', () => {
  let useCase: PublishEventUseCase;
  let publisher: jest.Mocked<EventPublisherPort>;

  beforeEach(async () => {
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PublishEventUseCase,
        { provide: EVENT_PUBLISHER, useValue: publisher },
      ],
    }).compile();

    useCase = moduleRef.get(PublishEventUseCase);
  });

  it('генерирует eventId и occurredAt и передаёт их в publisher', async () => {
    const result = await useCase.execute({
      eventType: 'user.registered',
      payload: { userId: 42 },
    });

    expect(result.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(result.occurredAt).toString()).not.toBe('Invalid Date');

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const [routingKey, event] = publisher.publish.mock.calls[0] as [string, DomainEvent];
    expect(routingKey).toBe(RoutingKeys.EventCreated);
    expect(event.eventId).toBe(result.eventId);
    expect(event.eventType).toBe('user.registered');
    expect(event.payload).toEqual({ userId: 42 });
  });

  it('сохраняет переданный correlationId если он указан', async () => {
    const result = await useCase.execute({
      eventType: 'order.placed',
      payload: { orderId: 'A-1' },
      correlationId: 'fixed-corr-id',
    });

    expect(result.correlationId).toBe('fixed-corr-id');
    const [, event] = publisher.publish.mock.calls[0];
    expect(event.correlationId).toBe('fixed-corr-id');
  });

  it('пробрасывает ошибку если publisher упал', async () => {
    publisher.publish.mockRejectedValue(new Error('broker down'));

    await expect(
      useCase.execute({ eventType: 'x', payload: {} }),
    ).rejects.toThrow('broker down');
  });

  it('генерирует уникальные eventId на каждый вызов', async () => {
    const a = await useCase.execute({ eventType: 't', payload: {} });
    const b = await useCase.execute({ eventType: 't', payload: {} });
    expect(a.eventId).not.toBe(b.eventId);
  });
});

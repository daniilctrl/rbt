import { Test } from '@nestjs/testing';
import type { DomainEvent } from '@app/contracts';
import { HandleEventUseCase } from './handle-event.use-case';
import { IDEMPOTENCY_STORE, IdempotencyStorePort } from './ports/idempotency-store.port';
import {
  NOTIFICATION_PUBLISHER,
  NotificationPublisherPort,
} from './ports/notification-publisher.port';

const makeEvent = (overrides: Partial<DomainEvent> = {}): DomainEvent => ({
  eventId: '11111111-1111-1111-1111-111111111111',
  eventType: 'test.event',
  occurredAt: '2026-05-01T00:00:00.000Z',
  correlationId: 'corr-1',
  payload: { foo: 'bar' },
  ...overrides,
});

describe('HandleEventUseCase', () => {
  let useCase: HandleEventUseCase;
  let idempotency: jest.Mocked<IdempotencyStorePort>;
  let publisher: jest.Mocked<NotificationPublisherPort>;

  beforeEach(async () => {
    idempotency = { markIfFresh: jest.fn() };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HandleEventUseCase,
        { provide: IDEMPOTENCY_STORE, useValue: idempotency },
        { provide: NOTIFICATION_PUBLISHER, useValue: publisher },
      ],
    }).compile();

    useCase = moduleRef.get(HandleEventUseCase);
  });

  it('обрабатывает свежее событие и публикует уведомление', async () => {
    idempotency.markIfFresh.mockResolvedValue(true);

    const result = await useCase.execute(makeEvent(), 'default-chat');

    expect(result.status).toBe('processed');
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    const call = publisher.publish.mock.calls[0][0];
    expect(call.causedByEventId).toBe('11111111-1111-1111-1111-111111111111');
    expect(call.chatId).toBe('default-chat');
    expect(call.correlationId).toBe('corr-1');
  });

  it('пропускает дубликат и не публикует уведомление', async () => {
    idempotency.markIfFresh.mockResolvedValue(false);

    const result = await useCase.execute(makeEvent(), 'default-chat');

    expect(result.status).toBe('duplicate');
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('использует chatId из payload если он указан', async () => {
    idempotency.markIfFresh.mockResolvedValue(true);

    await useCase.execute(
      makeEvent({ payload: { chatId: 'custom-chat', message: 'hi' } }),
      'default-chat',
    );

    const call = publisher.publish.mock.calls[0][0];
    expect(call.chatId).toBe('custom-chat');
    expect(call.text).toBe('hi');
  });

  it('пробрасывает ошибку публикации (consumer должен сделать nack/retry)', async () => {
    idempotency.markIfFresh.mockResolvedValue(true);
    publisher.publish.mockRejectedValue(new Error('broker down'));

    await expect(useCase.execute(makeEvent(), 'default-chat')).rejects.toThrow('broker down');
  });
});

/**
 * Routing keys — единственная точка истины. Если поменяется здесь,
 * автоматически подхватится во всех трёх сервисах.
 */
export const RoutingKeys = {
  EventCreated: 'event.created',
  EventRetry: 'event.retry',
  NotifyTelegram: 'notify.telegram',
} as const;

export type RoutingKey = (typeof RoutingKeys)[keyof typeof RoutingKeys];

/**
 * Имена headers, которые мы используем для счётчика ретраев.
 */
export const MessageHeaders = {
  RetryCount: 'x-retry-count',
  CorrelationId: 'x-correlation-id',
} as const;

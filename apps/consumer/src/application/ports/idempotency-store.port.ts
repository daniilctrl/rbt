/**
 * Порт для проверки идемпотентности.
 *
 * markIfFresh(eventId) — атомарно «забить» eventId. Возвращает:
 *   true  — eventId был свежим, обработка должна продолжиться
 *   false — eventId уже видели, нужно сделать ack без обработки
 *
 * В боевой реализации это `SET NX EX <ttl>` в Redis. В тестах — Map.
 */
export interface IdempotencyStorePort {
  markIfFresh(eventId: string): Promise<boolean>;
}

export const IDEMPOTENCY_STORE = Symbol('IDEMPOTENCY_STORE');

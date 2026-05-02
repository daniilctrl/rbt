/**
 * Доменное событие, публикуемое Producer'ом в events.exchange.
 * eventId — UUID v4, ключ идемпотентности на стороне Consumer'а.
 */
export interface DomainEvent<TPayload = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: string; // ISO-8601
  correlationId: string;
  payload: TPayload;
}

/**
 * Полезная нагрузка для уведомления — это поле кладётся в DomainEvent.payload
 * когда событие изначально предназначено для Telegram. Producer/Consumer не
 * обязаны знать про этот тип, но это удобный «дефолтный» payload.
 */
export interface NotifyEventPayload {
  chatId?: string; // если undefined — Telegram-сервис возьмёт TELEGRAM_DEFAULT_CHAT_ID
  message: string;
  parseMode?: 'Markdown' | 'HTML';
}

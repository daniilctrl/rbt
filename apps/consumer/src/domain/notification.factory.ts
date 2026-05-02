import { v4 as uuidv4 } from 'uuid';
import type { DomainEvent, NotifyEventPayload, TelegramNotification } from '@app/contracts';

/**
 * Чисто-доменная функция: превращает DomainEvent в TelegramNotification.
 * Без зависимостей от инфраструктуры — легко тестируется.
 *
 * Логика по ТЗ — «произвольный формат». Делаю простой текстовый шаблон;
 * при желании усложнить — это единственное место, где нужно будет менять.
 */
export class NotificationFactory {
  static fromEvent(
    event: DomainEvent<unknown>,
    defaultChatId: string,
  ): TelegramNotification {
    const payload = (event.payload ?? {}) as Partial<NotifyEventPayload> & Record<string, unknown>;

    const chatId = typeof payload.chatId === 'string' ? payload.chatId : defaultChatId;
    const explicitMessage = typeof payload.message === 'string' ? payload.message : null;

    const text = explicitMessage ?? this.formatDefault(event);
    const parseMode = payload.parseMode === 'HTML' || payload.parseMode === 'Markdown'
      ? payload.parseMode
      : 'HTML';

    return {
      notificationId: uuidv4(),
      causedByEventId: event.eventId,
      correlationId: event.correlationId,
      chatId,
      text,
      parseMode,
    };
  }

  private static formatDefault(event: DomainEvent<unknown>): string {
    const payloadStr = JSON.stringify(event.payload, null, 2);
    return [
      `<b>${this.escapeHtml(event.eventType)}</b>`,
      `<i>${event.occurredAt}</i>`,
      `<pre>${this.escapeHtml(payloadStr)}</pre>`,
    ].join('\n');
  }

  private static escapeHtml(s: string): string {
    return s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}

/**
 * Сообщение, которое Consumer публикует в notifications.exchange.
 * Telegram-notifier подписан на это и отправляет в Bot API.
 */
export interface TelegramNotification {
  notificationId: string; // UUID v4
  causedByEventId: string; // eventId исходного DomainEvent'а — для трассировки
  correlationId: string;
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

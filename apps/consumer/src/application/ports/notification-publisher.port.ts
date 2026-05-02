import type { TelegramNotification } from '@app/contracts';

/**
 * Порт для публикации Telegram-уведомлений в notifications.exchange.
 * Consumer не знает про конкретный брокер — через интерфейс.
 */
export interface NotificationPublisherPort {
  publish(notification: TelegramNotification): Promise<void>;
}

export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');

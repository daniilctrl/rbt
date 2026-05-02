import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TelegramNotification } from '@app/contracts';
import {
  TELEGRAM_CLIENT,
  TelegramClientPort,
} from './ports/telegram-client.port';

@Injectable()
export class SendTelegramNotificationUseCase {
  private readonly logger = new Logger(SendTelegramNotificationUseCase.name);

  constructor(
    @Inject(TELEGRAM_CLIENT) private readonly client: TelegramClientPort,
  ) {}

  async execute(notification: TelegramNotification): Promise<void> {
    this.logger.log({
      msg: 'sending telegram notification',
      notificationId: notification.notificationId,
      causedByEventId: notification.causedByEventId,
      correlationId: notification.correlationId,
      chatId: notification.chatId,
    });

    const result = await this.client.sendMessage({
      chatId: notification.chatId,
      text: notification.text,
      parseMode: notification.parseMode,
    });

    this.logger.log({
      msg: 'telegram notification delivered',
      notificationId: notification.notificationId,
      tgMessageId: result.messageId,
    });
  }
}

/**
 * Порт для Telegram Bot API. В тестах подменяется на FakeTelegramClient.
 *
 * isPermanent у выброшенной ошибки = true означает, что повторять бесполезно
 * (например, 400 Bad Request — неправильный chatId). Consumer-обвязка
 * на это парком отправит сообщение в DLQ без ретраев.
 */
export interface TelegramClientPort {
  sendMessage(input: SendMessageInput): Promise<SendMessageResult>;
}

export interface SendMessageInput {
  chatId: string;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
}

export interface SendMessageResult {
  messageId: number;
  date: number;
}

export const TELEGRAM_CLIENT = Symbol('TELEGRAM_CLIENT');

export class TelegramTransientError extends Error {
  readonly isPermanent = false;
  constructor(message: string) {
    super(message);
    this.name = 'TelegramTransientError';
  }
}

export class TelegramPermanentError extends Error {
  readonly isPermanent = true;
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'TelegramPermanentError';
  }
}

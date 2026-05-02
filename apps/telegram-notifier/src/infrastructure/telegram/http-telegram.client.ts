import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  SendMessageInput,
  SendMessageResult,
  TelegramClientPort,
  TelegramPermanentError,
  TelegramTransientError,
} from '../../application/ports/telegram-client.port';
import { telegramConfig } from './telegram.config';

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface TelegramMessage {
  message_id: number;
  date: number;
}

@Injectable()
export class HttpTelegramClient implements TelegramClientPort {
  private readonly logger = new Logger(HttpTelegramClient.name);

  constructor(
    private readonly http: HttpService,
    @Inject(telegramConfig.KEY) private readonly cfg: ConfigType<typeof telegramConfig>,
  ) {
    if (!cfg.botToken || cfg.botToken === 'your_bot_token_here') {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not set — sendMessage will fail');
    }
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const url = `${this.cfg.apiBase}/bot${this.cfg.botToken}/sendMessage`;
    const body = {
      chat_id: input.chatId,
      text: input.text,
      parse_mode: input.parseMode,
    };

    try {
      const { data } = await firstValueFrom(
        this.http.post<TelegramApiResponse<TelegramMessage>>(url, body, {
          timeout: this.cfg.requestTimeoutMs,
        }),
      );

      if (!data.ok || !data.result) {
        throw new TelegramPermanentError(
          `Telegram API responded ok=false: ${data.description}`,
          data.error_code,
        );
      }

      return { messageId: data.result.message_id, date: data.result.date };
    } catch (err) {
      if (err instanceof TelegramPermanentError) throw err;

      const axiosErr = err as AxiosError<TelegramApiResponse<unknown>>;
      const status = axiosErr.response?.status;

      // 4xx (кроме 429) — клиентская ошибка, ретраить бесполезно
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw new TelegramPermanentError(
          `Telegram API ${status}: ${axiosErr.response?.data?.description ?? axiosErr.message}`,
          status,
        );
      }

      // 5xx, 429, network errors, таймауты — transient, имеет смысл ретраить
      throw new TelegramTransientError(
        `Telegram API transient error (status=${status ?? 'network'}): ${axiosErr.message}`,
      );
    }
  }
}

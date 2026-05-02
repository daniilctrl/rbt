import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { telegramConfig } from './telegram.config';
import { HttpTelegramClient } from './http-telegram.client';
import { TELEGRAM_CLIENT } from '../../application/ports/telegram-client.port';

@Module({
  imports: [ConfigModule.forFeature(telegramConfig), HttpModule],
  providers: [
    HttpTelegramClient,
    { provide: TELEGRAM_CLIENT, useExisting: HttpTelegramClient },
  ],
  // telegramConfig.KEY используется только HttpTelegramClient'ом внутри этого
  // модуля, наружу его экспортировать нельзя (Nest не пускает экспорт провайдеров
  // из импортированных динамических модулей).
  exports: [TELEGRAM_CLIENT],
})
export class TelegramModule {}

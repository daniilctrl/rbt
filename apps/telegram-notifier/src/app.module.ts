import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TelegramModule } from './infrastructure/telegram/telegram.module';
import { RabbitModule } from './infrastructure/rabbit/rabbit.module';
import { NotificationsConsumer } from './infrastructure/rabbit/notifications.consumer';
import { SendTelegramNotificationUseCase } from './application/send-telegram-notification.use-case';
import { HealthController } from './infrastructure/http/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    TelegramModule,
    RabbitModule,
  ],
  controllers: [HealthController],
  providers: [SendTelegramNotificationUseCase, NotificationsConsumer],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { loadConfig } from './config/configuration';
import { RabbitModule } from './infrastructure/rabbit/rabbit.module';
import { EventsController } from './infrastructure/http/events.controller';
import { HealthController } from './infrastructure/http/health.controller';
import { PublishEventUseCase } from './application/publish-event.use-case';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        // Привязываем correlationId из заголовка x-correlation-id если он есть
        customProps: (req) => ({
          correlationId: (req.headers['x-correlation-id'] as string) ?? undefined,
        }),
      },
    }),
    RabbitModule,
  ],
  controllers: [EventsController, HealthController],
  providers: [PublishEventUseCase],
})
export class AppModule {}

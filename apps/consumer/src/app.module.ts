import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { RabbitModule } from './infrastructure/rabbit/rabbit.module';
import { EventsConsumer } from './infrastructure/rabbit/events.consumer';
import { RedisModule } from './infrastructure/redis/redis.module';
import { HandleEventUseCase } from './application/handle-event.use-case';
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
    RedisModule,
    RabbitModule,
  ],
  controllers: [HealthController],
  // EventsConsumer регистрируется здесь, в composition root, чтобы он мог
  // одновременно инжектить инфраструктуру (AmqpConnection из RabbitModule)
  // и application-слой (HandleEventUseCase). Если бы он жил в RabbitModule,
  // тот не видел бы AppModule и не смог бы резолвить use-case.
  providers: [HandleEventUseCase, EventsConsumer],
})
export class AppModule {}

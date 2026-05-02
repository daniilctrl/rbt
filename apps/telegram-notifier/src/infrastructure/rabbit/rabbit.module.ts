import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { rabbitConfig } from './rabbit.config';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forFeature(rabbitConfig),
    TelegramModule,
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule.forFeature(rabbitConfig)],
      inject: [rabbitConfig.KEY],
      useFactory: (cfg: ConfigType<typeof rabbitConfig>) => ({
        uri: cfg.url,
        connectionInitOptions: { wait: true, timeout: 20000 },
        connectionManagerOptions: {
          heartbeatIntervalInSeconds: 15,
          reconnectTimeInSeconds: 5,
        },
        exchanges: [
          { name: cfg.notificationsExchange, type: 'topic', options: { durable: true } },
        ],
        queues: [
          {
            name: cfg.retryQueue,
            options: {
              durable: true,
              arguments: {
                'x-message-ttl': cfg.retryTtlMs,
                'x-dead-letter-exchange': cfg.notificationsExchange,
                'x-dead-letter-routing-key': 'notify.telegram.retry',
              },
            },
          },
          { name: cfg.dlq, options: { durable: true } },
        ],
        channels: {
          'tg-channel': { default: true, prefetchCount: 5 },
        },
      }),
    }),
  ],
  providers: [],
  // Экспортируем RabbitMQModule (для AmqpConnection) и ConfigModule (для rabbitConfig),
  // чтобы NotificationsConsumer мог их инжектить из AppModule.
  exports: [RabbitMQModule, ConfigModule],
})
export class RabbitModule {}

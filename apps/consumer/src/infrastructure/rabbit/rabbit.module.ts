import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { rabbitConfig } from './rabbit.config';
import { RabbitNotificationPublisherAdapter } from './rabbit-notification-publisher.adapter';
import { NOTIFICATION_PUBLISHER } from '../../application/ports/notification-publisher.port';

/**
 * Топология RabbitMQ для Consumer-сервиса:
 *   events.exchange (topic)        — вход
 *   events.q                        — основная очередь обработки (объявляется в @RabbitSubscribe)
 *   events.retry.q                  — отлёживание перед повторной попыткой (TTL → events.exchange)
 *   events.dlq.parking              — конечная остановка (после исчерпания ретраев)
 *
 *   notifications.exchange (topic) — выход (для следующего сервиса в цепочке)
 *
 * Очереди объявляем здесь, чтобы они существовали при старте независимо от того,
 * какой сервис стартанул первым.
 */
@Module({
  imports: [
    ConfigModule.forFeature(rabbitConfig),
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
          { name: cfg.eventsExchange, type: 'topic', options: { durable: true } },
          { name: cfg.notificationsExchange, type: 'topic', options: { durable: true } },
        ],
        queues: [
          {
            name: cfg.eventsRetryQueue,
            options: {
              durable: true,
              arguments: {
                'x-message-ttl': cfg.retryTtlMs,
                'x-dead-letter-exchange': cfg.eventsExchange,
                'x-dead-letter-routing-key': 'event.retry',
              },
            },
          },
          {
            name: cfg.eventsDlq,
            options: { durable: true },
          },
        ],
        channels: {
          'consumer-channel': {
            default: true,
            prefetchCount: 10,
          },
        },
      }),
    }),
  ],
  providers: [
    RabbitNotificationPublisherAdapter,
    { provide: NOTIFICATION_PUBLISHER, useExisting: RabbitNotificationPublisherAdapter },
  ],
  // Экспортируем NOTIFICATION_PUBLISHER (для use-case'а) и сам RabbitMQModule
  // (чтобы AmqpConnection и rabbitConfig были видны в AppModule, где мы
  // регистрируем EventsConsumer вместе с его зависимостями из application-слоя).
  exports: [NOTIFICATION_PUBLISHER, RabbitMQModule, ConfigModule],
})
export class RabbitModule {}

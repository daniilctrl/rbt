import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { rabbitConfig } from './rabbit.config';
import { RabbitEventPublisherAdapter } from './rabbit-event-publisher.adapter';
import { EVENT_PUBLISHER } from '../../application/ports/event-publisher.port';

@Module({
  imports: [
    ConfigModule.forFeature(rabbitConfig),
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule.forFeature(rabbitConfig)],
      inject: [rabbitConfig.KEY],
      useFactory: (cfg: ConfigType<typeof rabbitConfig>) => ({
        uri: cfg.url,
        // Топология объявляется здесь — exchange должен существовать
        // независимо от того, кто стартанул первым.
        exchanges: [
          {
            name: cfg.exchange,
            type: 'topic',
            options: { durable: true },
          },
        ],
        // Включаем publisher confirms — без этого publish() не дожидается ack.
        enableControllerDiscovery: false,
        connectionInitOptions: { wait: true, timeout: 20000 },
        connectionManagerOptions: {
          heartbeatIntervalInSeconds: 15,
          reconnectTimeInSeconds: 5,
        },
        channels: {
          'publisher-channel': {
            default: true,
            // confirm-mode: publish() резолвится после ack от брокера
            prefetchCount: 0,
          },
        },
      }),
    }),
  ],
  providers: [
    RabbitEventPublisherAdapter,
    {
      provide: EVENT_PUBLISHER,
      useExisting: RabbitEventPublisherAdapter,
    },
  ],
  exports: [EVENT_PUBLISHER],
})
export class RabbitModule {}

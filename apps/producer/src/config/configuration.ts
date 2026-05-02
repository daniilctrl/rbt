export interface ProducerConfig {
  port: number;
  rabbit: {
    url: string;
    exchange: string;
    publishTimeoutMs: number;
    publishRetries: number;
  };
  log: {
    level: string;
  };
}

export const loadConfig = (): ProducerConfig => ({
  port: parseInt(process.env.PRODUCER_PORT ?? '3000', 10),
  rabbit: {
    url: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    exchange: process.env.EVENTS_EXCHANGE ?? 'events.exchange',
    publishTimeoutMs: parseInt(process.env.PUBLISH_TIMEOUT_MS ?? '5000', 10),
    publishRetries: parseInt(process.env.PUBLISH_RETRIES ?? '3', 10),
  },
  log: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
});

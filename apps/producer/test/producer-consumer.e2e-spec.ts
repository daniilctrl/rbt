/**
 * End-to-end тест связки Producer → RabbitMQ → Consumer → notifications.exchange.
 *
 * Поднимаем настоящий RabbitMQ через Testcontainers, запускаем Producer
 * и Consumer как Nest-приложения, делаем POST /events, ждём пока сообщение
 * долетит до notifications.telegram.q и проверяем содержимое.
 *
 * Telegram-сервис в этом тесте не запускается — мы проверяем именно связку
 * Producer→Consumer и факт публикации в notifications.exchange.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import * as request from 'supertest';
import * as amqp from 'amqplib';

import { AppModule as ProducerModule } from '../src/app.module';
// Consumer запускаем из соседнего workspace-пакета
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — relative path to sibling app
import { AppModule as ConsumerModule } from '../../consumer/src/app.module';

jest.setTimeout(120_000);

describe('Producer → Consumer (e2e)', () => {
  let rabbitContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let producerApp: INestApplication;
  let consumerApp: INestApplication;
  let amqpConn: amqp.Connection;

  beforeAll(async () => {
    rabbitContainer = await new GenericContainer('rabbitmq:3.13-management-alpine')
      .withExposedPorts(5672, 15672)
      .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
      .start();

    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    const amqpUrl = `amqp://guest:guest@${rabbitContainer.getHost()}:${rabbitContainer.getMappedPort(
      5672,
    )}`;

    process.env.RABBITMQ_URL = amqpUrl;
    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = String(redisContainer.getMappedPort(6379));
    process.env.TELEGRAM_DEFAULT_CHAT_ID = 'test-chat';
    process.env.LOG_LEVEL = 'warn';

    // Producer
    const producerModule: TestingModule = await Test.createTestingModule({
      imports: [ProducerModule],
    }).compile();
    producerApp = producerModule.createNestApplication();
    producerApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await producerApp.init();

    // Consumer
    const consumerModule: TestingModule = await Test.createTestingModule({
      imports: [ConsumerModule],
    }).compile();
    consumerApp = consumerModule.createNestApplication();
    await consumerApp.init();

    // Прямое AMQP-подключение для проверки очереди
    amqpConn = await amqp.connect(amqpUrl);
  });

  afterAll(async () => {
    await amqpConn?.close();
    await producerApp?.close();
    await consumerApp?.close();
    await rabbitContainer?.stop();
    await redisContainer?.stop();
  });

  it('публикует событие, consumer обогащает и кладёт уведомление в notifications.telegram.q', async () => {
    // Готовим временный потребитель notifications.telegram.q чтобы поймать сообщение
    const channel = await amqpConn.createChannel();
    await channel.assertExchange('notifications.exchange', 'topic', { durable: true });
    const { queue } = await channel.assertQueue('notifications.telegram.q', { durable: true });
    await channel.bindQueue(queue, 'notifications.exchange', 'notify.telegram');

    const received: amqp.ConsumeMessage[] = [];
    await channel.consume(
      queue,
      (msg) => {
        if (msg) {
          received.push(msg);
          channel.ack(msg);
        }
      },
      { noAck: false },
    );

    // POST /events
    const res = await request(producerApp.getHttpServer())
      .post('/events')
      .send({
        eventType: 'user.registered',
        payload: { userId: 42, message: 'привет из e2e' },
      })
      .expect(202);

    expect(res.body.eventId).toMatch(/^[0-9a-f-]{36}$/);

    // Ждём пока сообщение долетит
    const deadline = Date.now() + 15_000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(received.length).toBeGreaterThan(0);
    const payload = JSON.parse(received[0].content.toString());
    expect(payload.causedByEventId).toBe(res.body.eventId);
    expect(payload.text).toBe('привет из e2e');
  });
});

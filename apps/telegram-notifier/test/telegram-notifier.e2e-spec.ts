/**
 * E2E для Telegram-notifier:
 *  - поднимаем настоящий RabbitMQ через Testcontainers
 *  - мокаем api.telegram.org через nock
 *  - публикуем TelegramNotification в notifications.exchange
 *  - проверяем что nock увидел POST /sendMessage с правильным телом
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import * as amqp from 'amqplib';
import * as nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { AppModule } from '../src/app.module';

jest.setTimeout(120_000);

describe('Telegram-notifier (e2e)', () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let amqpConn: amqp.Connection;

  beforeAll(async () => {
    container = await new GenericContainer('rabbitmq:3.13-management-alpine')
      .withExposedPorts(5672)
      .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
      .start();

    const amqpUrl = `amqp://guest:guest@${container.getHost()}:${container.getMappedPort(5672)}`;
    process.env.RABBITMQ_URL = amqpUrl;
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    process.env.TELEGRAM_API_BASE = 'https://api.telegram.org';
    process.env.LOG_LEVEL = 'warn';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    amqpConn = await amqp.connect(amqpUrl);
  });

  afterAll(async () => {
    nock.cleanAll();
    await amqpConn?.close();
    await app?.close();
    await container?.stop();
  });

  it('получает уведомление из очереди и шлёт его в Bot API', async () => {
    let capturedBody: any = null;
    nock('https://api.telegram.org')
      .post(/\/bot.+\/sendMessage/, (body) => {
        capturedBody = body;
        return true;
      })
      .reply(200, {
        ok: true,
        result: { message_id: 777, date: Math.floor(Date.now() / 1000) },
      });

    // Публикуем TelegramNotification руками в exchange
    const channel = await amqpConn.createChannel();
    await channel.assertExchange('notifications.exchange', 'topic', { durable: true });

    const notification = {
      notificationId: uuidv4(),
      causedByEventId: uuidv4(),
      correlationId: uuidv4(),
      chatId: '12345',
      text: '<b>e2e test</b>',
      parseMode: 'HTML' as const,
    };

    channel.publish(
      'notifications.exchange',
      'notify.telegram',
      Buffer.from(JSON.stringify(notification)),
      { persistent: true, contentType: 'application/json' },
    );

    // Ждём пока nock зафиксирует вызов
    const deadline = Date.now() + 15_000;
    while (!capturedBody && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.chat_id).toBe('12345');
    expect(capturedBody.text).toBe('<b>e2e test</b>');
    expect(capturedBody.parse_mode).toBe('HTML');
  });
});

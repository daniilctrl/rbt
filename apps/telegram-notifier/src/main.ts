import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const port = parseInt(process.env.TELEGRAM_NOTIFIER_PORT ?? '3002', 10);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Telegram notifier is running on port ${port}, listening to notifications.telegram.q`);
}

bootstrap();

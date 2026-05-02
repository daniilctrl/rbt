import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // Consumer не имеет HTTP-входа, но nestjs-pino требует HTTP-обвязки.
  // Поднимем технический порт для healthcheck'ов в docker-compose.
  const port = parseInt(process.env.CONSUMER_PORT ?? '3001', 10);
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Consumer is running on port ${port}, listening to events.q`);
}

bootstrap();

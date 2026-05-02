import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Producer API')
    .setDescription(
      'Принимает доменные события и публикует их в RabbitMQ. Поддерживает идемпотентность через генерацию UUID-eventId и подтверждения через publisher confirms.',
    )
    .setVersion('0.1.0')
    .addTag('events')
    .addTag('health')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  const port = parseInt(process.env.PRODUCER_PORT ?? '3000', 10);
  await app.listen(port);

  // Используем Nest-логгер чтобы не плодить вторую цепочку
  const logger = app.get(Logger);
  logger.log(`Producer is running on port ${port} — Swagger at /api`);
}

bootstrap();

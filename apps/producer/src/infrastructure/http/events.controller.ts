import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublishEventUseCase } from '../../application/publish-event.use-case';
import { PublishFailedError } from '../../application/ports/event-publisher.port';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly publishEvent: PublishEventUseCase) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Опубликовать доменное событие в RabbitMQ',
    description:
      'Producer добавит eventId (UUID v4), occurredAt и correlationId, затем опубликует событие в events.exchange с указанным routing key. Ответ возвращается только после publisher confirm от брокера.',
  })
  @ApiResponse({ status: 202, type: EventResponseDto, description: 'Событие подтверждено брокером' })
  @ApiResponse({ status: 500, description: 'Брокер недоступен после ретраев' })
  async create(@Body() dto: CreateEventDto): Promise<EventResponseDto> {
    try {
      return await this.publishEvent.execute({
        eventType: dto.eventType,
        payload: dto.payload,
        correlationId: dto.correlationId,
        routingKey: dto.routingKey,
      });
    } catch (err) {
      if (err instanceof PublishFailedError) {
        throw new InternalServerErrorException({
          message: 'Failed to publish event after retries',
          cause: (err.cause as Error)?.message,
        });
      }
      throw err;
    }
  }
}

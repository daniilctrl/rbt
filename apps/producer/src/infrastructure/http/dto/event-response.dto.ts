import { ApiProperty } from '@nestjs/swagger';

export class EventResponseDto {
  @ApiProperty({ description: 'UUID v4 события — ключ идемпотентности на consumer-стороне' })
  eventId!: string;

  @ApiProperty({ description: 'CorrelationId для трассировки в логах всех сервисов' })
  correlationId!: string;

  @ApiProperty({ description: 'Время создания события (ISO-8601)' })
  occurredAt!: string;
}

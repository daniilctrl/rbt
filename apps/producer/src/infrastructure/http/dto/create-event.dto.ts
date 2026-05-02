import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEventDto {
  @ApiProperty({
    example: 'user.registered',
    description: 'Тип события — произвольная dot-нотация',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  eventType!: string;

  @ApiProperty({
    type: Object,
    example: { userId: 42, email: 'user@example.com' },
    description: 'Произвольный JSON-payload события',
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'd9b1d3c4-1f2e-4f3b-bb74-c3f1e3a2c1f0',
    description:
      'Опциональный correlationId для трассировки. Если не передать — Producer сгенерирует UUID v4',
  })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({
    example: 'event.created',
    description: 'Опциональный routing key. По умолчанию event.created',
  })
  @IsOptional()
  @IsString()
  routingKey?: string;
}

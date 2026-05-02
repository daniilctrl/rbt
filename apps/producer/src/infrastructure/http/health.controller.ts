import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe для Docker healthcheck' })
  check() {
    return { status: 'ok', service: 'producer', timestamp: new Date().toISOString() };
  }
}

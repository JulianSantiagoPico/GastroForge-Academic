import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Verificación del estado del servicio (Health Check)',
    description: 'Comprueba la disponibilidad y tiempo de actividad del servicio para Render y monitoreo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio en estado saludable.',
    schema: {
      example: {
        status: 'ok',
        uptime: 45.2,
        timestamp: '2026-09-02T20:55:00.000Z',
        service: 'gastroforge-academic-api',
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'gastroforge-academic-api',
    };
  }
}

import {
  Controller,
  Get,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EntityManager } from 'typeorm';
import { RedisSlidingWindowAdapter } from '../appresso/redis/redis-sliding-window.adapter';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  service: string;
  services: {
    postgres: 'up' | 'down' | 'disabled';
    redis: 'up' | 'degraded' | 'disabled';
  };
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @Optional() private readonly entityManager?: EntityManager,
    @Optional() private readonly redisAdapter?: RedisSlidingWindowAdapter,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Verificación del estado del servicio (Health Check)',
    description:
      'Comprueba la disponibilidad y tiempo de actividad del servicio para Render y monitoreo, validando PostgreSQL y Redis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Servicio en estado saludable o degradado pero operativo.',
  })
  @ApiResponse({
    status: 503,
    description: 'Servicio no disponible por falla crítica en la base de datos.',
  })
  async getHealth(): Promise<HealthResponse> {
    let postgresStatus: 'up' | 'down' | 'disabled' = 'disabled';
    let redisStatus: 'up' | 'degraded' | 'disabled' = 'disabled';

    if (this.entityManager) {
      try {
        await this.entityManager.query('SELECT 1');
        postgresStatus = 'up';
      } catch (err: any) {
        postgresStatus = 'down';
        throw new ServiceUnavailableException({
          status: 'down',
          message: 'PostgreSQL connection failed',
          error: err.message,
        });
      }
    }

    if (this.redisAdapter) {
      redisStatus = this.redisAdapter.isAvailable() ? 'up' : 'degraded';
    }

    const overallStatus: 'ok' | 'degraded' =
      redisStatus === 'degraded' ? 'degraded' : 'ok';

    return {
      status: overallStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'gastroforge-academic-api',
      services: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
    };
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  AppressoMetricsService,
  AppressoMetricsSnapshot,
} from './appresso-metrics.service';

/**
 * Endpoint de lectura de las métricas en proceso de Appresso (A1.5).
 *
 * Existe para que el reporte de carga sea reproducible: el script de simulación puede contrastar
 * lo que el cliente observó con lo que el servidor realmente procesó, y separar el limitador
 * HTTP del detector.
 *
 * No está sujeto al limitador dedicado de escritura: un 429 durante la recogida de evidencia
 * invalidaría la medición que se pretende observar.
 */
@ApiTags('Appresso - Detección de Fraude')
@Controller('appresso/metrics')
@SkipThrottle()
export class AppressoMetricsController {
  constructor(private readonly metrics: AppressoMetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar contadores y latencias observados por el módulo Appresso',
    description:
      'Devuelve contadores por origen de rechazo (throttler, validation, hmac, endpoint), ' +
      'transacciones procesadas, duplicados, episodios de anomalía creados/actualizados/cerrados y ' +
      'percentiles de latencia del endpoint de ingesta.',
  })
  @ApiOkResponse({ description: 'Instantánea de métricas en proceso' })
  getMetrics(): AppressoMetricsSnapshot {
    return this.metrics.snapshot();
  }
}
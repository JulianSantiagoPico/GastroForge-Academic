import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import {
  AnomaliesService,
  QueryAnomaliesFilter,
  AnomaliesSummary,
} from './anomalies.service';
import { EpisodeStatus } from './anomaly-episode';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAnomalyStatusDto {
  @IsEnum(EpisodeStatus, {
    message: 'El estado debe ser OPEN, CLOSED, REVIEWED o DISMISSED',
  })
  status: EpisodeStatus;

  @IsOptional()
  @IsString()
  reviewerOrNotes?: string;
}

@ApiTags('Appresso - Detección de Fraude')
@Controller('appresso/anomalies')
export class AppressoAnomaliesController {
  constructor(private readonly anomaliesService: AnomaliesService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar episodios de anomalías paginados (A5.1)',
    description: 'Permite filtrar anomalías por usuario, estado y rangos de fechas.',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: EpisodeStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAnomalies(@Query() filter: QueryAnomaliesFilter) {
    return await this.anomaliesService.getAnomalies(filter);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen estadístico y métricas agregadas de anomalías (A5.2)',
    description:
      'Calcula agregados directamente en PostgreSQL sin sobrecargar la memoria con históricos masivos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas agregadas obtenidas',
  })
  async getSummary(): Promise<AnomaliesSummary> {
    return await this.anomaliesService.getSummary();
  }

  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary: 'Actualizar estado de un episodio de anomalía (A5.3)',
    description:
      'Aplica transiciones de auditoría. Cumple la regla estricta: un episodio CLOSED nunca se reabre.',
  })
  @ApiParam({ name: 'id', description: 'UUID del episodio de anomalía' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAnomalyStatusDto,
  ) {
    return await this.anomaliesService.updateStatus(
      id,
      dto.status,
      dto.reviewerOrNotes,
    );
  }
}

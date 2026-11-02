import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SalonSummaryDto {
  @ApiProperty({ description: 'Total de mesas configuradas en el salón', example: 6 })
  @IsNumber()
  total_tables: number;

  @ApiProperty({ description: 'Mesas completamente libres e higienizadas', example: 3 })
  @IsNumber()
  free_tables: number;

  @ApiProperty({ description: 'Mesas con comensales sentados', example: 2 })
  @IsNumber()
  occupied_tables: number;

  @ApiProperty({ description: 'Mesas sucias con platos pendientes por recoger', example: 1 })
  @IsNumber()
  pending_clean_tables: number;

  @ApiProperty({ description: 'Mesas actualmente en proceso de desinfección', example: 0 })
  @IsNumber()
  cleaning_tables: number;

  @ApiProperty({ description: 'Mesas con ausencia temporal justificada (baño / caja)', example: 0 })
  @IsNumber()
  temporary_absence_tables: number;

  @ApiProperty({ description: 'Porcentaje de ocupación actual del salón (0 - 100%)', example: 33.3 })
  @IsNumber()
  occupancy_rate_percent: number;
}

export class SalonKPISummaryDto {
  @ApiPropertyOptional({ description: 'Tiempo promedio hasta el primer plato servido en segundos (TPA)', example: 120.5 })
  @IsNumber()
  @IsOptional()
  avg_first_service_latency_seconds?: number | null;

  @ApiPropertyOptional({ description: 'Tiempo promedio de rotación y limpieza en segundos (TRM)', example: 45.2 })
  @IsNumber()
  @IsOptional()
  avg_turnover_latency_seconds?: number | null;

  @ApiPropertyOptional({ description: 'Tiempo promedio de permanencia total de clientes en segundos', example: 1800.0 })
  @IsNumber()
  @IsOptional()
  avg_stay_duration_seconds?: number | null;

  @ApiProperty({ description: 'Conteo de incidentes de clientes sentados en mesas con platos sucios', example: 0 })
  @IsNumber()
  hygiene_incidents_count: number;

  @ApiProperty({ description: 'Clientes en espera detectados en zona de ingreso', example: 0 })
  @IsNumber()
  waiting_queue_count: number;

  @ApiProperty({ description: 'Indica si hay mesas libres pero lentitud de atención', example: false })
  @IsBoolean()
  service_bottleneck_detected: boolean;

  @ApiProperty({ description: 'Indica si hay baja demanda sin clientes en espera', example: false })
  @IsBoolean()
  low_demand_detected: boolean;

  @ApiProperty({ description: 'Diagnóstico operativo en lenguaje natural', example: 'OPERACION_BALANCEADA' })
  @IsString()
  operational_diagnosis: string;
}

export class TableTelemetryDto {
  @ApiProperty({ description: 'Identificador único de la mesa', example: 'Mesa 1' })
  @IsString()
  @IsNotEmpty()
  table_id: string;

  @ApiProperty({ description: 'Estado actual en la máquina de estados', example: 'ocupada' })
  @IsString()
  state: string;

  @ApiPropertyOptional({ description: 'Identificador de la sesión de comensales activa', example: 'Mesa 1_s1' })
  @IsString()
  @IsOptional()
  current_session_id?: string | null;

  @ApiProperty({ description: 'Bandera booleana de ocupación activa', example: true })
  @IsBoolean()
  is_occupied: boolean;

  @ApiProperty({ description: 'Segundos acumulados de ocupación en la sesión actual', example: 35.0 })
  @IsNumber()
  occupied_duration_seconds: number;

  @ApiProperty({ description: 'Duración formateada en formato HH:MM:SS', example: '00:00:35' })
  @IsString()
  occupied_duration_formatted: string;

  @ApiProperty({ description: 'Indica si ya se sirvió al menos un plato en la mesa', example: true })
  @IsBoolean()
  first_dish_served: boolean;

  @ApiProperty({ description: 'Indica si ocurrió un incidente de higiene en la sesión', example: false })
  @IsBoolean()
  has_hygiene_incident: boolean;
}

export class IngestTelemetryDto {
  @ApiProperty({ description: 'Identificador del sistema emisor de visión computacional', example: 'GastroForge-Vision-Ultralytics' })
  @IsString()
  @IsNotEmpty()
  system: string;

  @ApiProperty({ description: 'Marca de tiempo ISO 8601 de captura', example: '2026-11-02T01:00:00Z' })
  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({ description: 'Segundo relativo del video o flujo en tiempo real', example: 43.0 })
  @IsNumber()
  current_time_seconds: number;

  @ApiProperty({ description: 'Resumen cuantitativo del estado de las mesas en el salón', type: SalonSummaryDto })
  @ValidateNested()
  @Type(() => SalonSummaryDto)
  salon_summary: SalonSummaryDto;

  @ApiProperty({ description: 'Métricas analíticas y KPIs operativos calculados por la visión', type: SalonKPISummaryDto })
  @ValidateNested()
  @Type(() => SalonKPISummaryDto)
  kpis: SalonKPISummaryDto;

  @ApiProperty({ description: 'Arreglo con el estado detallado de cada mesa individual', type: [TableTelemetryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TableTelemetryDto)
  tables: TableTelemetryDto[];
}

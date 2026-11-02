import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';
import { VisionTelemetryService } from './vision-telemetry.service';

@ApiTags('Vision-Telemetry')
@Controller('telemetry')
@UsePipes(
  new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    whitelist: true,
    forbidNonWhitelisted: false,
    stopAtFirstError: true,
  })
)
export class VisionTelemetryController {
  constructor(private readonly telemetryService: VisionTelemetryService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ingesta de telemetría desde el motor de visión por computadora Ultralytics YOLO',
    description:
      'Recibe el estado en tiempo real de ocupación de mesas, latencias TPA/TRM e incidentes de higiene para integrarlos al ecosistema GastroForge.',
  })
  @ApiBody({
    type: IngestTelemetryDto,
    description: 'Payload estructurado de telemetría del salón generado por el sistema de visión.',
  })
  @ApiResponse({
    status: 201,
    description: 'Telemetría procesada y registrada exitosamente en memoria.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en la estructura del payload.',
  })
  ingestTelemetry(@Body() dto: IngestTelemetryDto) {
    return this.telemetryService.ingest(dto);
  }

  @Get('salon')
  @ApiOperation({
    summary: 'Estado actual y consolidado del salón gastronómico',
    description:
      'Devuelve el resumen de ocupación, indicadores de rendimiento (KPIs), diagnóstico operativo y alertas activas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen consolidado del salón.',
  })
  getSalonStatus() {
    return this.telemetryService.getSalonStatus();
  }

  @Get('tables')
  @ApiOperation({
    summary: 'Listado detallado de todas las mesas monitorizadas',
    description: 'Retorna el estado de cada mesa, tiempo de permanencia y estado de servicio.',
  })
  @ApiResponse({
    status: 200,
    description: 'Arreglo de mesas con su estado actual de visión.',
  })
  getTables() {
    return this.telemetryService.getTables();
  }

  @Get('tables/:tableId')
  @ApiOperation({
    summary: 'Consulta individual de una mesa por identificador',
    description: 'Obtiene el estado específico y sesión activa de la mesa indicada.',
  })
  @ApiParam({
    name: 'tableId',
    description: 'Identificador único de la mesa (ej: "Mesa 1", "Mesa 2")',
    example: 'Mesa 1',
  })
  @ApiResponse({
    status: 200,
    description: 'Información de la mesa solicitada.',
  })
  @ApiResponse({
    status: 404,
    description: 'Mesa no encontrada en la telemetría actual.',
  })
  getTableById(@Param('tableId') tableId: string) {
    return this.telemetryService.getTableById(tableId);
  }

  @Get('dispatch-route/:tableId')
  @ApiOperation({
    summary: 'Ruta óptima de despacho (Dijkstra) desde la cocina hacia la mesa',
    description:
      'Mapea la mesa al grafo del salón y calcula el trayecto más rápido en segundos mediante el algoritmo de Dijkstra.',
  })
  @ApiParam({
    name: 'tableId',
    description: 'Identificador de la mesa de destino',
    example: 'Mesa 1',
  })
  @ApiResponse({
    status: 200,
    description: 'Ruta óptima, nodos de tránsito y tiempo estimado en segundos.',
  })
  getDispatchRoute(@Param('tableId') tableId: string) {
    return this.telemetryService.getDispatchRoute(tableId);
  }

  @Get('service-priority')
  @ApiOperation({
    summary: 'Cola de prioridad (MinHeap) de atención física a mesas',
    description:
      'Ordena las mesas por nivel de criticidad (incidentes de higiene > mesas sucias > espera de comensales) utilizando un Binary Heap O(log n).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista priorizada de tareas operativas y rutas desde cocina.',
  })
  getServicePriority() {
    return this.telemetryService.getServicePriorityQueue();
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StructuresService } from './structures.service';
import { QueueSimulationDto } from './dto/queue-simulation.dto';
import { PrioritySimulationDto } from './dto/priority-simulation.dto';
import { DraftSimulationDto } from './dto/draft-simulation.dto';
import { DefaultRouteQueryDto, ShortestPathDto } from './dto/shortest-path.dto';
import { OrderIndexDto } from './dto/order-index.dto';

@ApiTags('Data-Structures')
@Controller('structures')
@UsePipes(
  new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    whitelist: true,
    forbidNonWhitelisted: false,
    stopAtFirstError: true,
  })
)
export class StructuresController {
  constructor(private readonly structuresService: StructuresService) {}

  @Post('queue/simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulación de cola FIFO para atención de pedidos',
    description:
      'Encola una lista de pedidos en el orden exacto de llegada y los extrae secuencialmente en tiempo O(1) usando una lista enlazada.',
  })
  @ApiBody({
    type: QueueSimulationDto,
    description: 'Lote de pedidos en orden de llegada a cocina (ejemplo con múltiples comandas).',
  })
  @ApiResponse({
    status: 200,
    description: 'Secuencia de atención FIFO y análisis de complejidad de la cola.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación (por ejemplo lista vacía o más de 1000 pedidos).',
  })
  simulateQueue(@Body() dto: QueueSimulationDto) {
    return this.structuresService.simulateQueue(dto);
  }

  @Post('priority/simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulación de cola de prioridad (MinHeap) para despacho de cocina',
    description:
      'Calcula la prioridad efectiva (basePriority + waitingMinutes) de cada comanda y despacha en O(log n) la más urgente usando un montículo binario.',
  })
  @ApiBody({
    type: PrioritySimulationDto,
    description: 'Lista de comandas de cocina con diversos niveles de urgencia y tiempos de espera.',
  })
  @ApiResponse({
    status: 200,
    description: 'Secuencia de despacho priorizada y detalles del montículo binario.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación (por ejemplo lista con más de 1000 tareas o urgencia inválida).',
  })
  simulatePriority(@Body() dto: PrioritySimulationDto) {
    return this.structuresService.simulatePriority(dto);
  }

  @Post('stack/simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simulación de pila (Stack) para historial de borrador Undo/Redo',
    description:
      'Aplica acciones sobre un borrador de comanda (ADD, UPDATE, REMOVE, UNDO, REDO) gestionando dos pilas LIFO deterministas con operaciones en O(1).',
  })
  @ApiBody({
    type: DraftSimulationDto,
    description: 'Secuencia multi-paso con agregar, actualizar, eliminar, deshacer y rehacer.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado final del borrador, historial de pasos y métricas de las pilas.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en la lista de acciones.',
  })
  simulateDraft(@Body() dto: DraftSimulationDto) {
    return this.structuresService.simulateDraft(dto);
  }

  @Get('graph/default-route')
  @ApiOperation({
    summary: 'Ruta óptima en el plano predeterminado del restaurante (Dijkstra)',
    description:
      'Ejecuta el algoritmo de Dijkstra sobre el plano estándar de GastroForge (cocina, pasillo, barra, mesas, terraza) utilizando un MinHeap interno.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ruta más corta, nodos visitados y tiempo de recorrido en segundos.',
  })
  getDefaultRoute(@Query() query: DefaultRouteQueryDto) {
    return this.structuresService.getDefaultRoute(query);
  }

  @Post('graph/shortest-path')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ruta óptima sobre grafo ponderado personalizado (Dijkstra)',
    description:
      'Construye un grafo controlado enviado en la petición y calcula el camino de menor costo entre dos nodos. Rechaza aristas negativas y maneja nodos inalcanzables.',
  })
  @ApiBody({
    type: ShortestPathDto,
    description: 'Red completa de nodos y aristas ponderadas transitables en el restaurante.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado del cálculo de Dijkstra sobre el grafo personalizado.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación (aristas con costos negativos o límites de nodos excedidos).',
  })
  getShortestPath(@Body() dto: ShortestPathDto) {
    return this.structuresService.getShortestPath(dto);
  }

  @Post('index/simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Comparación de acceso directo O(1) con Map vs búsqueda lineal O(n)',
    description:
      'Indexa pedidos en un Map temporal en memoria y ejecuta consultas por ID comparando operaciones de acceso hash directo O(1) frente a recorrido lineal O(n).',
  })
  @ApiBody({
    type: OrderIndexDto,
    description: 'Conjunto de pedidos y múltiples identificadores para comparar O(1) vs O(n).',
  })
  @ApiResponse({
    status: 200,
    description: 'Comparación empírica de operaciones entre Map y búsqueda secuencial.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en parámetros de búsqueda.',
  })
  simulateIndex(@Body() dto: OrderIndexDto) {
    return this.structuresService.simulateIndex(dto);
  }

  @Get('compare')
  @ApiOperation({
    summary: 'Matriz comparativa de estructuras de datos académicas',
    description:
      'Retorna un resumen de cada estructura implementada (Cola FIFO, MinHeap, Pila LIFO, Grafo Ponderado, Map), sus casos de uso en GastroForge, operaciones clave y complejidades asintóticas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Matriz comparativa académica completa.',
  })
  getStructuresComparison() {
    return this.structuresService.getStructuresComparison();
  }
}

import { Controller, Get, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AcademicAnalysisService } from './academic-analysis.service';
import { BenchmarkQueryDto } from './dto/benchmark-query.dto';
import { QuadraticQueryDto } from './dto/quadratic-query.dto';
import { LoyaltyQueryDto } from './dto/loyalty-query.dto';
import { ForecastQueryDto } from './dto/forecast-query.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';

@ApiTags('Academic-Analysis')
@Controller('academic')
@UsePipes(
  new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    whitelist: true,
    forbidNonWhitelisted: false,
    stopAtFirstError: true,
  })
)
export class AcademicAnalysisController {
  constructor(private readonly academicService: AcademicAnalysisService) {}

  @Get('report')
  @ApiOperation({
    summary: 'Informe comparativo académico completo',
    description:
      'Ejecuta el benchmark general para los tamaños estándar (10, 100, 1.000, 10.000, 100.000), compara operaciones empíricas frente a complejidades teóricas e incluye progresión aritmética y regresión lineal.',
  })
  @ApiResponse({
    status: 200,
    description: 'Informe comparativo generado exitosamente.',
  })
  getReport() {
    return this.academicService.generateFullReport();
  }

  @Get('benchmark')
  @ApiOperation({
    summary: 'Benchmark de algoritmos lineales y recursivo',
    description:
      'Ejecuta búsqueda lineal (mejor, promedio o peor caso), agregación iterativa O(n) y agregación recursiva Divide y Vencerás O(n) sobre n pedidos simulados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultados del benchmark con métricas de operaciones y tiempo.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en parámetros (por ejemplo, size fuera de rango o caso inválido).',
  })
  getBenchmark(@Query() query: BenchmarkQueryDto) {
    return this.academicService.runBenchmark(query);
  }

  @Get('quadratic')
  @ApiOperation({
    summary: 'Algoritmo de complejidad cuadrática O(n²)',
    description:
      'Compara pares de pedidos. Si size <= 2000 ejecuta las comparaciones reales; si size > 2000 devuelve la estimación teórica n(n-1)/2 sin colapsar el servidor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de comparación cuadrática o estimación analítica.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación (size debe ser un entero entre 1 y 100000).',
  })
  getQuadratic(@Query() query: QuadraticQueryDto) {
    return this.academicService.runQuadratic(query);
  }

  @Get('loyalty')
  @ApiOperation({
    summary: 'Progresión aritmética de pedidos de fidelización',
    description:
      'Calcula en tiempo O(1) la semana en que un cliente alcanza una meta de pedidos semanales bajo la fórmula a_n = a_1 + (n - 1)d con a_1=2 y d=2.',
  })
  @ApiResponse({
    status: 200,
    description: 'Semanas calculadas para las metas solicitadas.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en las metas proporcionadas.',
  })
  getLoyalty(@Query() query: LoyaltyQueryDto) {
    return this.academicService.runLoyalty(query);
  }

  @Get('sales-forecast')
  @ApiOperation({
    summary: 'Regresión lineal y pronóstico de ventas a futuro',
    description:
      'Calcula la recta y = mx + b por mínimos cuadrados sobre datos históricos deterministas y proyecta ventas para días futuros (por defecto +2, +5 y +7 días).',
  })
  @ApiResponse({
    status: 200,
    description: 'Modelo de regresión lineal, parámetros y proyecciones calculadas.',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación en días proyectados.',
  })
  getSalesForecast(@Query() query: ForecastQueryDto) {
    return this.academicService.runSalesForecast(query);
  }

  @Get('orders')
  @ApiOperation({
    summary: 'Inspección de pedidos generados en memoria',
    description:
      'Permite visualizar de forma paginada los pedidos simulados deterministas generados por order-generator.ts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Muestra paginada de pedidos generados en memoria.',
  })
  getOrders(@Query() query: OrdersQueryDto) {
    return this.academicService.getOrdersSample(query.limit, query.page);
  }
}

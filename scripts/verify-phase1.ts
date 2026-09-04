import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO VERIFICACIÓN COMPLETA DE FASE 1 (PA-01 a PA-11)');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });

  app.enableCors();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/academic') && !req.url.startsWith('/api/v1/academic')) {
      req.url = `/api/v1${req.url}`;
    } else if (req.url === '/health') {
      req.url = '/api/v1/health';
    }
    next();
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    })
  );

  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'string' ? 3000 : address?.port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(
    id: string,
    name: string,
    url: string,
    expectedStatus: number,
    validator: (data: any) => boolean
  ) {
    try {
      const response = await fetch(`${baseUrl}${url}`);
      const statusMatch = response.status === expectedStatus;
      const data = await response.json();
      const logicMatch = validator(data);

      if (statusMatch && logicMatch) {
        console.log(`✅ [${id}] PASS: ${name}`);
        passed++;
      } else {
        console.error(`❌ [${id}] FAIL: ${name}`);
        console.error(`   Status esperado: ${expectedStatus}, obtenido: ${response.status}`);
        console.error(`   Respuesta:`, JSON.stringify(data).slice(0, 150) + '...');
        failed++;
      }
    } catch (err) {
      console.error(`❌ [${id}] ERROR: ${name} ->`, err);
      failed++;
    }
  }

  // PA-01: Health check
  await test('PA-01', 'GET /health debe responder 200 y status ok', '/health', 200, (d) => {
    return d.status === 'ok' && typeof d.uptime === 'number';
  });

  // PA-02: Reporte académico
  await test(
    'PA-02',
    'GET /api/v1/academic/report debe generar reporte con 5 tamaños estándar',
    '/api/v1/academic/report',
    200,
    (d) => {
      return (
        Array.isArray(d.comparativeTable) &&
        d.comparativeTable.length === 5 &&
        d.comparativeTable[4].size === 100000 &&
        d.loyaltyProgressionCase &&
        d.salesForecastCase
      );
    }
  );

  // PA-03: Benchmark size=2000
  await test(
    'PA-03',
    'GET /api/v1/academic/benchmark?size=2000 con 2.000 operaciones en peor caso',
    '/api/v1/academic/benchmark?size=2000',
    200,
    (d) => {
      return (
        d.linearSearch.operations === 2000 &&
        d.productAggregation.operations === 2000 &&
        d.recursiveAggregation.operations === 2000 &&
        d.recursiveAggregation.maxDepth === 11
      );
    }
  );

  // PA-04: Benchmark size=1
  await test(
    'PA-04',
    'GET /api/v1/academic/benchmark?size=1 con 1 operación',
    '/api/v1/academic/benchmark?size=1',
    200,
    (d) => {
      return (
        d.linearSearch.operations === 1 &&
        d.productAggregation.operations === 1 &&
        d.recursiveAggregation.operations === 1
      );
    }
  );

  // PA-05: Benchmark size=100000
  await test(
    'PA-05',
    'GET /api/v1/academic/benchmark?size=100000 sin desbordamiento de pila',
    '/api/v1/academic/benchmark?size=100000',
    200,
    (d) => {
      return (
        d.linearSearch.operations === 100000 &&
        d.productAggregation.operations === 100000 &&
        d.recursiveAggregation.operations === 100000 &&
        d.recursiveAggregation.maxDepth <= 20
      );
    }
  );

  // PA-06: Cuadrático con size=2000 (ejecutado)
  await test(
    'PA-06',
    'GET /api/v1/academic/quadratic?size=2000 ejecutado con 1.999.000 comparaciones',
    '/api/v1/academic/quadratic?size=2000',
    200,
    (d) => {
      return d.executed === true && d.operations === 1999000;
    }
  );

  // PA-07: Cuadrático con size=10000 (estimado)
  await test(
    'PA-07',
    'GET /api/v1/academic/quadratic?size=10000 estimado con 49.995.000 operaciones',
    '/api/v1/academic/quadratic?size=10000',
    200,
    (d) => {
      return d.executed === false && d.estimatedOperations === 49995000 && !!d.reason;
    }
  );

  // PA-08: Validación límite superior (size=100001)
  await test(
    'PA-08',
    'GET /api/v1/academic/benchmark?size=100001 debe retornar 400 Bad Request',
    '/api/v1/academic/benchmark?size=100001',
    400,
    (d) => {
      return d.statusCode === 400;
    }
  );

  // PA-09: Validación tipo alfanumérico (size=abc)
  await test(
    'PA-09',
    'GET /api/v1/academic/benchmark?size=abc debe retornar 400 Bad Request',
    '/api/v1/academic/benchmark?size=abc',
    400,
    (d) => {
      return d.statusCode === 400;
    }
  );

  // PA-10: Fidelización con progresión aritmética
  await test(
    'PA-10',
    'GET /api/v1/academic/loyalty?targets=42,72,120 retorna semanas 21, 36 y 60',
    '/api/v1/academic/loyalty?targets=42,72,120',
    200,
    (d) => {
      const targets = d.targets;
      return (
        targets.length === 3 &&
        targets[0].calculatedWeek === 21 &&
        targets[1].calculatedWeek === 36 &&
        targets[2].calculatedWeek === 60
      );
    }
  );

  // PA-11: Proyección de ventas con regresión lineal
  await test(
    'PA-11',
    'GET /api/v1/academic/sales-forecast?daysAhead=2,5,7 retorna modelo y 3 proyecciones',
    '/api/v1/academic/sales-forecast?daysAhead=2,5,7',
    200,
    (d) => {
      return (
        d.linearRegressionModel &&
        typeof d.linearRegressionModel.slope_m === 'number' &&
        Array.isArray(d.forecasts) &&
        d.forecasts.length === 3
      );
    }
  );

  await app.close();

  console.log('\n====================================================');
  console.log(`📊 RESULTADO FINAL: ${passed} PASADAS / ${failed} FALLIDAS`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Error fatal ejecutando pruebas:', err);
  process.exit(1);
});

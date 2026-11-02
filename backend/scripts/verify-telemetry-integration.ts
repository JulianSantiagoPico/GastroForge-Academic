import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

async function runTelemetryVerification() {
  console.log('====================================================');
  console.log('🛰️ VERIFICACIÓN INTEGRADA: TELEMETRÍA VISIÓN -> GASTROFORGE');
  console.log('====================================================\n');

  const app = await NestFactory.create(AppModule, { logger: false });

  app.enableCors();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/telemetry') && !req.url.startsWith('/api/v1/telemetry')) {
      req.url = `/api/v1${req.url}`;
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
  const baseUrl = `http://localhost:${port}/api/v1/telemetry`;

  try {
    // 1. Ingesta de telemetría
    console.log('1. Probando POST /api/v1/telemetry/ingest...');
    const ingestPayload = {
      system: 'GastroForge-Vision-Ultralytics',
      timestamp: new Date().toISOString(),
      current_time_seconds: 43.0,
      salon_summary: {
        total_tables: 3,
        free_tables: 1,
        occupied_tables: 1,
        pending_clean_tables: 1,
        cleaning_tables: 0,
        temporary_absence_tables: 0,
        occupancy_rate_percent: 33.3,
      },
      kpis: {
        avg_first_service_latency_seconds: 14.5,
        avg_turnover_latency_seconds: 38.0,
        avg_stay_duration_seconds: 110.0,
        hygiene_incidents_count: 1,
        waiting_queue_count: 2,
        service_bottleneck_detected: true,
        low_demand_detected: false,
        operational_diagnosis: 'CUELLO_DE_BOTELLA_DETECTADO',
      },
      tables: [
        {
          table_id: 'Mesa 1',
          state: 'ocupada',
          current_session_id: 'Mesa 1_s1',
          is_occupied: true,
          occupied_duration_seconds: 45.0,
          occupied_duration_formatted: '00:00:45',
          first_dish_served: false,
          has_hygiene_incident: true,
        },
        {
          table_id: 'Mesa 2',
          state: 'por_recoger',
          current_session_id: 'Mesa 2_s1',
          is_occupied: false,
          occupied_duration_seconds: 80.0,
          occupied_duration_formatted: '00:01:20',
          first_dish_served: true,
          has_hygiene_incident: false,
        },
        {
          table_id: 'Mesa 3',
          state: 'libre',
          current_session_id: null,
          is_occupied: false,
          occupied_duration_seconds: 0.0,
          occupied_duration_formatted: '00:00:00',
          first_dish_served: false,
          has_hygiene_incident: false,
        },
      ],
    };

    const ingestRes = await fetch(`${baseUrl}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ingestPayload),
    });
    const ingestData = await ingestRes.json();
    if (ingestRes.status !== 201 || !ingestData.success) {
      throw new Error(`Fallo en ingest: HTTP ${ingestRes.status} -> ${JSON.stringify(ingestData)}`);
    }
    console.log(`   ✔ Ingesta exitosa: ${ingestData.ingestedTables} mesas registradas.`);

    // 2. Consulta de estado del salón
    console.log('2. Probando GET /api/v1/telemetry/salon...');
    const salonRes = await fetch(`${baseUrl}/salon`);
    const salonData = await salonRes.json();
    if (salonRes.status !== 200 || salonData.salonSummary.total_tables !== 3) {
      throw new Error(`Fallo en salon: HTTP ${salonRes.status}`);
    }
    console.log(`   ✔ Resumen de salón verificado (Ocupación: ${salonData.salonSummary.occupancy_rate_percent}%).`);

    // 3. Ruta óptima con Dijkstra hacia Mesa 1
    console.log('3. Probando GET /api/v1/telemetry/dispatch-route/Mesa 1...');
    const routeRes = await fetch(`${baseUrl}/dispatch-route/Mesa 1`);
    const routeData = await routeRes.json();
    if (routeRes.status !== 200 || !routeData.reachable || routeData.transitSeconds !== 12) {
      throw new Error(`Fallo en ruta Dijkstra: ${JSON.stringify(routeData)}`);
    }
    console.log(`   ✔ Dijkstra verificado: Cocina -> Mesa 1 en ${routeData.transitSeconds}s (${routeData.path.join(' -> ')}).`);

    // 4. Cola de prioridad con MinHeap
    console.log('4. Probando GET /api/v1/telemetry/service-priority...');
    const prioRes = await fetch(`${baseUrl}/service-priority`);
    const prioData = await prioRes.json();
    if (prioRes.status !== 200 || prioData.prioritizedTasks[0].tableId !== 'Mesa 1') {
      throw new Error(`Fallo en MinHeap de prioridad: ${JSON.stringify(prioData)}`);
    }
    console.log(`   ✔ Prioridad MinHeap verificada: Mesa 1 con criticidad '${prioData.prioritizedTasks[0].urgencyLevel}'.`);

    console.log('\n====================================================');
    console.log('🎉 TODAS LAS VERIFICACIONES DE INTEGRACIÓN PASARON');
    console.log('====================================================');
  } finally {
    await app.close();
  }
}

runTelemetryVerification().catch((err) => {
  console.error('❌ Error en verificación:', err);
  process.exit(1);
});

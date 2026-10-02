import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { computeHmac } from '../src/modules/appresso/crypto/hmac';
import { CreateAppressoTransactionDto } from '../src/modules/appresso/dto/create-transaction.dto';
import {
  APPRESSO_REJECT_ORIGIN_HEADER,
  APPRESSO_TEST_TRACE_HEADER,
  APPRESSO_THROTTLER_REJECTED_HEADER,
  RejectOrigin,
} from '../src/modules/appresso/appresso.constants';

/**
 * Simulador de carga del bot de Appresso (A6.1 - A6.5).
 *
 * El objetivo de este script no es "golpear" el endpoint, sino producir una medición
 * **atribuible**: cada escalón registra cuántos rechazos sprang del limitador HTTP y cuántos
 * produjo el endpoint, por separado. Sin esa separación, un `429` del limitador se atribuiría al
 * detector y el punto de quiebre reportado sería falso.
 *
 * El origen de cada respuesta se lee de la cabecera `x-appresso-reject-origin`, que el servidor
 * escribe de forma explícita. Si la cabecera no estuviera, se degrada a una clasificación por
 * código HTTP y el reporte lo marca como `inferred: true`.
 */

interface EscalonSpec {
  nombre: string;
  /** Número total de peticiones del escalón. */
  total: number;
  /** Peticiones en vuelo simultáneas. */
  concurrencia: number;
  /** Usuario objetivo; los escalones de contención comparten usuario. */
  usuario: string;
}

interface RespuestaObservada {
  status: number;
  body: any;
  latenciaMs: number;
  origen: RejectOrigin;
  origenInferido: boolean;
}

interface MetricasEscalon {
  escalon: string;
  requests_sent: number;
  requests_accepted: number;
  requests_rejected_total: number;
  rejected_by_origin: Record<string, number>;
  latencia_ms: { p50: number; p95: number; p99: number; max: number; min: number };
  anomalies_detected: number;
  duplicates_handled: number;
  http_4xx: number;
  http_5xx: number;
  error_rate: number;
  /** Duración real del escalón en ms, útil para calcular RPS efectivo. */
  duration_ms: number;
  rps_efectivo: number;
}

const ESCALONES: EscalonSpec[] = [
  { nombre: 'warmup', total: 10, concurrencia: 1, usuario: 'load_warmup' },
  { nombre: 'escalon-1', total: 25, concurrencia: 5, usuario: 'load_target_01' },
  { nombre: 'escalon-2', total: 50, concurrencia: 10, usuario: 'load_target_01' },
  { nombre: 'escalon-3', total: 100, concurrencia: 25, usuario: 'load_target_01' },
  { nombre: 'escalon-4', total: 100, concurrencia: 50, usuario: 'load_multi' },
];

const ORIGENES: RejectOrigin[] = [
  RejectOrigin.THROTTLER,
  RejectOrigin.VALIDATION,
  RejectOrigin.HMAC,
  RejectOrigin.ENDPOINT,
];

function percentil(ordenados: number[], q: number): number {
  if (ordenados.length === 0) return 0;
  const idx = Math.min(ordenados.length - 1, Math.floor(ordenados.length * q));
  return ordenados[idx];
}

async function runBotSimulation() {
  console.log('======================================================================');
  console.log('🚀 SIMULADOR DE CARGA DE BOT - APPRESSO FRAUD DETECTION (A6.1 - A6.5)');
  console.log('======================================================================');

  const secret = process.env.APPRESSO_HMAC_SECRET || 'gastroforge-default-dev-secret';
  process.env.APPRESSO_HMAC_SECRET = secret;

  // La anotación del proveedor de persistencia es obligatoria en el reporte: sin ella, una
  // medición hecha contra el fallback in-memory no es comparable con una hecha contra PostgreSQL.
  const persistencia = process.env.DATABASE_URL ? 'postgresql' : 'in-memory (fallback)';

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true }),
  );

  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'string' ? 3000 : address?.port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/appresso`;

  console.log(`[INFO] Servidor levantado en puerto ${port}`);
  console.log(`[INFO] Endpoint: ${baseUrl}/transactions`);
  console.log(`[INFO] Persistencia: ${persistencia}`);
  console.log(
    `[INFO] Limitador dedicado de Appresso: ${process.env.APPRESSO_THROTTLE_LIMIT ?? '600'} req / ${process.env.APPRESSO_THROTTLE_TTL ?? '60000'} ms\n`,
  );

  /** Envía una transacción y clasifica el resultado según el origen declarado por el servidor. */
  async function sendTransaction(dto: CreateAppressoTransactionDto): Promise<RespuestaObservada> {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Cabecera de traza: solo produce eco en el servidor, no otorga ningún bypass.
        [APPRESSO_TEST_TRACE_HEADER]: 'true',
      },
      body: JSON.stringify(dto),
    });
    const latenciaMs = Date.now() - start;

    const headerOrigen = res.headers.get(APPRESSO_REJECT_ORIGIN_HEADER);
    const headerThrottled = res.headers.get(APPRESSO_THROTTLER_REJECTED_HEADER);

    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    let origen: RejectOrigin;
    let origenInferido = false;

    if (headerOrigen && Object.values(RejectOrigin).includes(headerOrigen as RejectOrigin)) {
      origen = headerOrigen as RejectOrigin;
    } else {
      origenInferido = true;
      if (res.status === 429) origen = RejectOrigin.THROTTLER;
      else if (res.status === 401 || res.status === 403) origen = RejectOrigin.HMAC;
      else if (res.status === 400) origen = RejectOrigin.VALIDATION;
      else if (res.status >= 500) origen = RejectOrigin.ENDPOINT;
      else if (res.status === 200 || res.status === 201) origen = RejectOrigin.NONE;
      else origen = RejectOrigin.ENDPOINT;
    }

// Doble comprobación: si el limitador se activó pero el origen no lo refleja, el reporte
  // prefiere la señal explícita del limitador antes que cualquier otra clasificación.
    if (headerThrottled === 'true') {
      origen = RejectOrigin.THROTTLER;
    }

    return { status: res.status, body, latenciaMs, origen, origenInferido };
  }

  const resultadosEscalon: MetricasEscalon[] = [];
  let idSeq = 0;

  for (const escalon of ESCALONES) {
    const respuestas: RespuestaObservada[] = [];
    const startedAt = Date.now();

    // Pool fijo de `concurrencia` trabajadores: la concurrencia es explícita y repetible, en
    // lugar de disparar todas las peticiones con `Promise.all` y medir otra cosa.
    let enviados = 0;
    const workers = Array.from({ length: escalon.concurrencia }, async () => {
      while (enviados < escalon.total) {
        const actual = enviados++;
        idSeq += 1;

        const payload: CreateAppressoTransactionDto = {
          idTxn: `${escalon.nombre}-${idSeq}-${Date.now()}`,
          user: escalon.usuario,
          value: 150000,
          currency: 'COP',
          paymentMethod: 'CREDIT_CARD',
          date: new Date().toISOString(),
          hash: '',
        };
        payload.hash = computeHmac(payload, secret);

        respuestas.push(await sendTransaction(payload));
      }
    });

    await Promise.all(workers);

    const durationMs = Date.now() - startedAt;
    const latencias = respuestas.map((r) => r.latenciaMs).sort((a, b) => a - b);

    const rejectedByOrigin: Record<string, number> = {};
    for (const origen of ORIGENES) {
      rejectedByOrigin[origen] = respuestas.filter((r) => r.origen === origen).length;
    }

    const aceptadas = respuestas.filter(
      (r) => r.status === 200 || r.status === 201,
    );
    const anomalias = aceptadas.filter((r) => r.body?.anomaly?.detected).length;
    const duplicados = aceptadas.filter((r) => r.body?.isDuplicate).length;
    const http4xx = respuestas.filter((r) => r.status >= 400 && r.status < 500).length;
    const http5xx = respuestas.filter((r) => r.status >= 500).length;
    const rechazadas = respuestas.length - aceptadas.length;

    const metricas: MetricasEscalon = {
      escalon: escalon.nombre,
      requests_sent: respuestas.length,
      requests_accepted: aceptadas.length,
      requests_rejected_total: rechazadas,
      rejected_by_origin: rejectedByOrigin,
      latencia_ms: {
        p50: percentil(latencias, 0.5),
        p95: percentil(latencias, 0.95),
        p99: percentil(latencias, 0.99),
        max: latencias[latencias.length - 1] ?? 0,
        min: latencias[0] ?? 0,
      },
      anomalies_detected: anomalias,
      duplicates_handled: duplicados,
      http_4xx: http4xx,
      http_5xx: http5xx,
      error_rate:
        respuestas.length === 0
          ? 0
          : Number(((rechazadas / respuestas.length) * 100).toFixed(2)),
      duration_ms: durationMs,
      rps_efectivo:
        durationMs === 0
          ? respuestas.length
          : Number(((respuestas.length / durationMs) * 1000).toFixed(2)),
    };

    resultadosEscalon.push(metricas);

    const origenTexto = ORIGENES.filter((o) => rejectedByOrigin[o] > 0)
      .map((o) => `${o}=${rejectedByOrigin[o]}`)
      .join(', ') || 'ninguno';

    console.log(`\n▶ ${escalon.nombre}: ${escalon.total} peticiones, concurrencia ${escalon.concurrencia}`);
    console.log(
      `  aceptadas=${metricas.requests_accepted}/${metricas.requests_sent}  rechazadas=${metricas.requests_rejected_total}  ` +
        `origen=[${origenTexto}]`,
    );
    console.log(
      `  latencia p50=${metricas.latencia_ms.p50}ms p95=${metricas.latencia_ms.p95}ms p99=${metricas.latencia_ms.p99}ms  ` +
        `rps=${metricas.rps_efectivo}  anomalías=${metricas.anomalies_detected}  duplicados=${metricas.duplicates_handled}`,
    );
  }

  // --------------------------------------------------------------------
  // CONTRASTE CON LAS MÉTRICAS DEL SERVIDOR
  // --------------------------------------------------------------------
  const serverMetrics = await fetch(`${baseUrl}/metrics`).then((r) => r.json());

  const totalEnviadas = resultadosEscalon.reduce((s, m) => s + m.requests_sent, 0);
  const totalAceptadas = resultadosEscalon.reduce((s, m) => s + m.requests_accepted, 0);
  const totalThrottler = resultadosEscalon.reduce(
    (s, m) => s + m.rejected_by_origin[RejectOrigin.THROTTLER],
    0,
  );
  const totalEndpoint = resultadosEscalon.reduce(
    (s, m) => s + m.rejected_by_origin[RejectOrigin.ENDPOINT],
    0,
  );

  console.log('\n======================================================================');
  console.log('📊 REPORTE DE MÉTRICAS Y OBSERVABILIDAD (A6.3)');
  console.log('======================================================================');
  console.log(`  Total transacciones enviadas:      ${totalEnviadas}`);
  console.log(`  Aceptadas por el endpoint:         ${totalAceptadas}`);
  console.log(`  Rechazos del LIMITADOR (429):      ${totalThrottler}`);
  console.log(`  Rechazos del ENDPOINT (5xx):       ${totalEndpoint}`);
  console.log('  Nota: los rechazos del limitador NO son detecciones del algoritmo.');
  console.log('======================================================================\n');

  // --------------------------------------------------------------------
  // REPORTE ESTRUCTURADO (JSON por corrida)
  // --------------------------------------------------------------------
  const reporte = {
    generado_en: new Date().toISOString(),
    version_script: 'A6-ola1-correcciones',
    persistencia,
    throttle_limit: process.env.APPRESSO_THROTTLE_LIMIT ?? '600',
    throttle_ttl_ms: process.env.APPRESSO_THROTTLE_TTL ?? '60000',
    node_version: process.version,
    plataforma: `${process.platform}-${process.arch}`,
    escalones: resultadosEscalon,
    totales: {
      requests_sent: totalEnviadas,
      requests_accepted: totalAceptadas,
      rejected_by_throttler: totalThrottler,
      rejected_by_endpoint: totalEndpoint,
    },
    server_metrics: serverMetrics,
  };

  const outputDir = join(process.cwd(), 'reports');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `appresso-load-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(reporte, null, 2), 'utf8');

  console.log(`  Reporte JSON escrito en: ${outputPath}`);
  console.log('======================================================================');
  console.log('🎉 SIMULACIÓN COMPLETADA EXITOSAMENTE');
  console.log('======================================================================\n');

  await app.close();
}

runBotSimulation().catch((err) => {
  console.error('Error durante la simulación del bot:', err);
  process.exit(1);
});
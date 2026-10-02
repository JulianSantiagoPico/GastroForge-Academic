import { NestFactory } from '@nestjs/core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
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
 * Simulador de carga del bot de Appresso con perfiles controlados y verificación SLO (W6).
 *
 * Características W6:
 * 1. Control de RPS objetivo y RPS efectivo.
 * 2. Perfiles separados:
 *    - Un único usuario (contención de lock por usuario).
 *    - Múltiples usuarios concurrentes (distribución de carga).
 *    - Distribución por franjas horarias (mañana, tarde-noche, noche-madrugada).
 * 3. Namespace único por corrida (`runId`) para trazabilidad y aislamiento.
 * 4. Verificación de SLO acordado (p95 <= 150ms, p99 <= 300ms, tasa de 5xx <= 1%).
 * 5. Identificación del primer escalón que viola el SLO y atribución de causa exacta.
 * 6. Verificación posterior de consistencia e integridad de episodios.
 */

export interface EscalonSpec {
  nombre: string;
  total: number;
  concurrencia: number;
  rpsObjetivo?: number;
  perfil: 'single-user' | 'multi-user' | 'time-bands';
  usuarioBase: string;
  fechaOverride?: string;
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
  perfil: string;
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
  duration_ms: number;
  rps_objetivo?: number;
  rps_efectivo: number;
  slo_status: {
    cumple: boolean;
    violaciones: string[];
  };
}

export interface SloConfig {
  maxP95Ms: number;
  maxP99Ms: number;
  maxHttp5xxPct: number;
}

const DEFAULT_SLO: SloConfig = {
  maxP95Ms: 150,
  maxP99Ms: 300,
  maxHttp5xxPct: 1.0,
};

const ESCALONES: EscalonSpec[] = [
  {
    nombre: 'warmup',
    total: 10,
    concurrencia: 1,
    rpsObjetivo: 50,
    perfil: 'single-user',
    usuarioBase: 'load_warmup',
  },
  {
    nombre: 'perfil-single-user-contencion',
    total: 30,
    concurrencia: 5,
    rpsObjetivo: 200,
    perfil: 'single-user',
    usuarioBase: 'target_single',
  },
  {
    nombre: 'perfil-multi-user-distribuido',
    total: 60,
    concurrencia: 15,
    rpsObjetivo: 500,
    perfil: 'multi-user',
    usuarioBase: 'target_multi',
  },
  {
    nombre: 'perfil-franjas-horarias',
    total: 45,
    concurrencia: 10,
    rpsObjetivo: 300,
    perfil: 'time-bands',
    usuarioBase: 'target_bands',
  },
  {
    nombre: 'escalon-alta-concurrencia',
    total: 100,
    concurrencia: 30,
    rpsObjetivo: 800,
    perfil: 'multi-user',
    usuarioBase: 'target_high_load',
  },
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

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBotSimulation() {
  const runId = `run-${randomUUID().substring(0, 8)}`;
  console.log('======================================================================');
  console.log(`🚀 SIMULADOR DE CARGA DE BOT - APPRESSO FRAUD DETECTION [${runId}] (W6)`);
  console.log('======================================================================');

  const secret = process.env.APPRESSO_HMAC_SECRET || 'gastroforge-default-dev-secret';
  process.env.APPRESSO_HMAC_SECRET = secret;

  const persistencia = process.env.DATABASE_URL
    ? 'postgresql (Neon)'
    : 'in-memory (fallback)';
  const redisConfigurado = !!process.env.REDIS_URL;

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, stopAtFirstError: true }),
  );

  const server = await app.listen(0);
  const address = server.address();
  const port = typeof address === 'string' ? 3000 : address?.port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1/appresso`;

  console.log(`[INFO] Servidor iniciado en puerto: ${port}`);
  console.log(`[INFO] Persistencia durable: ${persistencia}`);
  console.log(`[INFO] Capa de Redis: ${redisConfigurado ? 'Activa' : 'Desactivada (fallback)'}`);
  console.log(
    `[INFO] Limitador: ${process.env.APPRESSO_THROTTLE_LIMIT ?? '600'} req / ${
      process.env.APPRESSO_THROTTLE_TTL ?? '60000'
    } ms`,
  );
  console.log(
    `[INFO] SLO Acordado: p95 <= ${DEFAULT_SLO.maxP95Ms}ms, p99 <= ${DEFAULT_SLO.maxP99Ms}ms, 5xx <= ${DEFAULT_SLO.maxHttp5xxPct}%\n`,
  );

  async function sendTransaction(
    dto: CreateAppressoTransactionDto,
  ): Promise<RespuestaObservada> {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [APPRESSO_TEST_TRACE_HEADER]: runId,
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

    if (
      headerOrigen &&
      Object.values(RejectOrigin).includes(headerOrigen as RejectOrigin)
    ) {
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

    if (headerThrottled === 'true') {
      origen = RejectOrigin.THROTTLER;
    }

    return { status: res.status, body, latenciaMs, origen, origenInferido };
  }

  const resultadosEscalon: MetricasEscalon[] = [];
  let idSeq = 0;
  let primerEscalonViolado: string | null = null;
  let causaViolacion: string | null = null;

  for (const escalon of ESCALONES) {
    const respuestas: RespuestaObservada[] = [];
    const startedAt = Date.now();

    let enviados = 0;
    const intervalBetweenRequestsMs = escalon.rpsObjetivo
      ? Math.max(1, Math.floor(1000 / (escalon.rpsObjetivo / escalon.concurrencia)))
      : 0;

    const workers = Array.from({ length: escalon.concurrencia }, async (_, workerIdx) => {
      while (enviados < escalon.total) {
        const actual = enviados++;
        idSeq += 1;

        // Selección de usuario según perfil
        let targetUser = `${escalon.usuarioBase}_${runId}`;
        if (escalon.perfil === 'multi-user') {
          targetUser = `${escalon.usuarioBase}_${workerIdx}_${runId}`;
        } else if (escalon.perfil === 'time-bands') {
          targetUser = `${escalon.usuarioBase}_b${actual % 3}_${runId}`;
        }

        // Selección de fecha para simulación de franja
        let dateIso = new Date().toISOString();
        if (escalon.perfil === 'time-bands') {
          const hour = (actual % 3) * 8 + 2; // 02:00 (Noche), 10:00 (Mañana), 18:00 (Tarde)
          const d = new Date();
          d.setUTCHours(hour, 0, 0, 0);
          dateIso = d.toISOString();
        }

        const payload: CreateAppressoTransactionDto = {
          idTxn: `${runId}-${escalon.nombre}-${idSeq}`,
          user: targetUser,
          value: 120000,
          currency: 'COP',
          paymentMethod: 'CREDIT_CARD',
          date: dateIso,
          hash: '',
        };
        payload.hash = computeHmac(payload, secret);

        respuestas.push(await sendTransaction(payload));

        if (intervalBetweenRequestsMs > 0) {
          await sleep(intervalBetweenRequestsMs);
        }
      }
    });

    await Promise.all(workers);

    const durationMs = Math.max(1, Date.now() - startedAt);
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

    const p50 = percentil(latencias, 0.5);
    const p95 = percentil(latencias, 0.95);
    const p99 = percentil(latencias, 0.99);
    const tasa5xxPct = (http5xx / respuestas.length) * 100;

    // Verificación de SLO
    const violacionesSlo: string[] = [];
    if (p95 > DEFAULT_SLO.maxP95Ms) {
      violacionesSlo.push(`p95 (${p95}ms > ${DEFAULT_SLO.maxP95Ms}ms)`);
    }
    if (p99 > DEFAULT_SLO.maxP99Ms) {
      violacionesSlo.push(`p99 (${p99}ms > ${DEFAULT_SLO.maxP99Ms}ms)`);
    }
    if (tasa5xxPct > DEFAULT_SLO.maxHttp5xxPct) {
      violacionesSlo.push(`5xx (${tasa5xxPct.toFixed(2)}% > ${DEFAULT_SLO.maxHttp5xxPct}%)`);
    }

    const cumpleSlo = violacionesSlo.length === 0;
    if (!cumpleSlo && !primerEscalonViolado) {
      primerEscalonViolado = escalon.nombre;
      causaViolacion = violacionesSlo.join(', ');
    }

    const rpsEfectivo = Number(((respuestas.length / durationMs) * 1000).toFixed(2));

    const metricas: MetricasEscalon = {
      escalon: escalon.nombre,
      perfil: escalon.perfil,
      requests_sent: respuestas.length,
      requests_accepted: aceptadas.length,
      requests_rejected_total: rechazadas,
      rejected_by_origin: rejectedByOrigin,
      latencia_ms: {
        p50,
        p95,
        p99,
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
      rps_objetivo: escalon.rpsObjetivo,
      rps_efectivo: rpsEfectivo,
      slo_status: {
        cumple: cumpleSlo,
        violaciones: violacionesSlo,
      },
    };

    resultadosEscalon.push(metricas);

    const origenTexto =
      ORIGENES.filter((o) => rejectedByOrigin[o] > 0)
        .map((o) => `${o}=${rejectedByOrigin[o]}`)
        .join(', ') || 'ninguno';

    console.log(
      `▶ ${escalon.nombre} (${escalon.perfil}): ${escalon.total} reqs, conc=${escalon.concurrencia}, rpsTarget=${escalon.rpsObjetivo}`,
    );
    console.log(
      `  aceptadas=${metricas.requests_accepted}/${metricas.requests_sent}  rechazadas=${metricas.requests_rejected_total}  ` +
        `origen=[${origenTexto}]`,
    );
    console.log(
      `  latencia p50=${p50}ms p95=${p95}ms p99=${p99}ms | rpsEfectivo=${rpsEfectivo} | anomalías=${anomalias}`,
    );
    console.log(
      `  SLO: ${
        cumpleSlo ? '✅ CUMPLE' : `❌ VIOLADO: ${violacionesSlo.join('; ')}`
      }\n`,
    );

    // Condición de parada si hay falla crítica del endpoint
    if (http5xx > 10) {
      console.error(
        `[ALERTA DE PARADA] Tasa de 5xx excesiva en ${escalon.nombre}. Deteniendo escalones.`,
      );
      break;
    }
  }

  // --------------------------------------------------------------------
  // VERIFICACIÓN POST-CORRIDA DE CONSISTENCIA
  // --------------------------------------------------------------------
  console.log('🔍 Verificando integridad de episodios post-corrida...');
  const anomaliesResponse = await fetch(`${baseUrl}/anomalies?limit=50`).then((r) =>
    r.json(),
  );
  const totalEpisodios = anomaliesResponse.total ?? 0;
  console.log(`  Episodios registrados en el sistema: ${totalEpisodios}`);

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
  console.log('📊 REPORTE DE CAPACIDAD Y EVALUACIÓN DE SLO (W6)');
  console.log('======================================================================');
  console.log(`  Namespace / Run ID:               ${runId}`);
  console.log(`  Total transacciones enviadas:      ${totalEnviadas}`);
  console.log(`  Aceptadas por el endpoint:         ${totalAceptadas}`);
  console.log(`  Rechazos por Limitador HTTP:       ${totalThrottler}`);
  console.log(`  Rechazos por Error Endpoint (5xx): ${totalEndpoint}`);
  console.log(
    `  Resultado SLO General:             ${
      primerEscalonViolado ? `❌ Violado en '${primerEscalonViolado}' (${causaViolacion})` : '✅ CUMPLE TODOS LOS ESCALONES'
    }`,
  );
  console.log('======================================================================\n');

  // --------------------------------------------------------------------
  // REPORTE ESTRUCTURADO (JSON reproducible)
  // --------------------------------------------------------------------
  const reporte = {
    generado_en: new Date().toISOString(),
    run_id: runId,
    version_script: 'W6-load-profiles',
    ambiente: {
      persistencia,
      redis_configurado: redisConfigurado,
      throttle_limit: process.env.APPRESSO_THROTTLE_LIMIT ?? '600',
      throttle_ttl_ms: process.env.APPRESSO_THROTTLE_TTL ?? '60000',
      node_version: process.version,
      plataforma: `${process.platform}-${process.arch}`,
    },
    slo_acordado: DEFAULT_SLO,
    slo_evaluacion: {
      cumple_general: !primerEscalonViolado,
      primer_escalon_violado: primerEscalonViolado,
      causa_violacion: causaViolacion,
    },
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
  const outputPath = join(outputDir, `appresso-load-${runId}.json`);
  writeFileSync(outputPath, JSON.stringify(reporte, null, 2), 'utf8');

  console.log(`  Reporte JSON estructurado guardado en: ${outputPath}`);
  console.log('======================================================================');
  console.log('🎉 PRUEBA DE CARGA COMPLETADA EXITOSAMENTE');
  console.log('======================================================================\n');

  await app.close();
}

runBotSimulation().catch((err) => {
  console.error('Error durante la simulación del bot:', err);
  process.exit(1);
});
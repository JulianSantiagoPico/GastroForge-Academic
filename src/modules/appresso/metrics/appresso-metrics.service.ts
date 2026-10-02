import { Injectable } from '@nestjs/common';

/** Nombres de contador emitidos por el módulo. */
export const METRIC = {
  REQUESTS_RECEIVED: 'appresso.requests_received',
  TRANSACTIONS_PROCESSED: 'appresso.transactions_processed',
  DUPLICATES_HANDLED: 'appresso.duplicates_handled',
  ANOMALIES_CREATED: 'appresso.anomalies_created',
  ANOMALIES_UPDATED: 'appresso.anomalies_updated',
  EPISODES_CLOSED: 'appresso.episodes_closed',
  REJECTED_BY_THROTTLER: 'appresso.rejected.throttler',
  REJECTED_BY_VALIDATION: 'appresso.rejected.validation',
  REJECTED_BY_HMAC: 'appresso.rejected.hmac',
  REJECTED_BY_ENDPOINT: 'appresso.rejected.endpoint',
  DB_QUERIES: 'appresso.db.queries',
  DB_ERRORS: 'appresso.db.errors',
  REDIS_DEGRADED: 'appresso.redis.degraded',
  REDIS_CIRCUIT_OPEN: 'appresso.redis.circuit_open',
  REDIS_RECONSTRUCTIONS: 'appresso.redis.reconstructions',
  REDIS_OPERATIONS: 'appresso.redis.operations',
  REDIS_ERRORS: 'appresso.redis.errors',
} as const;

export interface LatencySnapshot {
  count: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface AppressoMetricsSnapshot {
  startedAt: number;
  uptimeMs: number;
  counters: Record<string, number>;
  latency: Record<string, LatencySnapshot>;
}

/**
 * Registro de métricas en proceso, mínimo viable y sin dependencias externas (A1.5).
 *
 * No es un cliente de Prometheus: es un acumulador observable por logs y por un endpoint de
 * lectura. Existe porque el requisito real no es un sistema de monitoreo completo sino
 * **separar el origen de los rechazos** para que el reporte de carga no confunda el limitador
 * HTTP con el detector.
 *
 * El reservorio de latencias está acotado a propósito: si el proceso vive mucho tiempo bajo
 * carga, el costo de memoria debe permanecer constante y no crecer con el tráfico.
 */
@Injectable()
export class AppressoMetricsService {
  private static readonly MAX_LATENCY_SAMPLES = 2048;

  private readonly startedAt = Date.now();
  private readonly counters = new Map<string, number>();
  private readonly latencies = new Map<string, number[]>();

  /** Incrementa un contador en `by` (por defecto 1). */
  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  /** Registra una latencia observada en milisegundos para un endpoint. */
  observeLatency(endpoint: string, latencyMs: number): void {
    let samples = this.latencies.get(endpoint);
    if (!samples) {
      samples = [];
      this.latencies.set(endpoint, samples);
    }
    samples.push(Math.max(0, Math.round(latencyMs)));
    if (samples.length > AppressoMetricsService.MAX_LATENCY_SAMPLES) {
      // Desplazamiento en O(1): se descarta la muestra más antigua y el costo total
      // se mantiene amortizado por encima de un vector circular real.
      samples.shift();
    }
  }

  /** Instantánea legible por máquina de todos los contadores y latencias. */
  snapshot(): AppressoMetricsSnapshot {
    const counters: Record<string, number> = {};
    for (const [name, value] of this.counters.entries()) {
      counters[name] = value;
    }

    const latency: Record<string, LatencySnapshot> = {};
    for (const [endpoint, samples] of this.latencies.entries()) {
      latency[endpoint] = percentiles(samples);
    }

    return {
      startedAt: this.startedAt,
      uptimeMs: Date.now() - this.startedAt,
      counters,
      latency,
    };
  }

  /** Reinicia contadores y latencias. Útil entre corridas de carga comparables. */
  reset(): void {
    this.counters.clear();
    this.latencies.clear();
  }
}

/** Calcula percentiles sobre una muestra de latencias sin modificar el arreglo original. */
export function percentiles(values: number[]): LatencySnapshot {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
  };
}
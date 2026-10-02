import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import Redis from 'ioredis';
import {
  REDIS_CONFIG,
  REDIS_KEY_PREFIX,
  SLIDING_WINDOW_LUA_SCRIPT,
} from './redis.constants';
import { AppressoMetricsService, METRIC } from '../metrics/appresso-metrics.service';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface RedisWindowResult {
  count: number;
  source: 'redis';
  isDegraded: boolean;
}

export interface RedisAdapterConfig {
  redisUrl?: string;
  client?: Redis;
  connectTimeoutMs?: number;
  commandTimeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
}

/**
 * Adaptador de ventana deslizante con Redis para estado temporal compartido (W3).
 *
 * Principios de diseño:
 * 1. Conexión única y reutilizable (IoRedis) con TLS soportado (`rediss://` o certificados).
 * 2. Operación atómica en Redis mediante script Lua (purga + inserción + conteo + TTL).
 * 3. Borde inclusivo garantizado: eventos exactamente en `now - windowMs` se conservan.
 * 4. Circuit Breaker observable: si Redis falla o supera el umbral de errores, se degrada
 *    automáticamente a PostgreSQL o memoria, evitando bloquear las transacciones.
 * 5. Reconstrucción acotada: al restablecerse Redis, solo se reconstruyen eventos activos
 *    (`receivedAt >= now - windowMs`), nunca el historial completo.
 */
@Injectable()
export class RedisSlidingWindowAdapter implements OnModuleDestroy {
  private readonly logger = new Logger(RedisSlidingWindowAdapter.name);
  private client: Redis | null = null;
  private readonly redisUrl?: string;

  // Circuit Breaker state
  private circuitState: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly commandTimeoutMs: number;

  constructor(
    private readonly metrics: AppressoMetricsService,
    @Optional() config?: RedisAdapterConfig,
  ) {
    this.redisUrl = config?.redisUrl ?? process.env.REDIS_URL;
    this.failureThreshold =
      config?.failureThreshold ?? REDIS_CONFIG.CIRCUIT_FAILURE_THRESHOLD;
    this.cooldownMs = config?.cooldownMs ?? REDIS_CONFIG.CIRCUIT_COOLDOWN_MS;
    this.commandTimeoutMs =
      config?.commandTimeoutMs ?? REDIS_CONFIG.COMMAND_TIMEOUT_MS;

    if (config?.client) {
      this.client = config.client;
    } else if (this.redisUrl) {
      this.initClient(this.redisUrl, config?.connectTimeoutMs);
    }
  }

  private initClient(url: string, connectTimeoutMs?: number): void {
    try {
      this.client = new Redis(url, {
        connectTimeout: connectTimeoutMs ?? REDIS_CONFIG.CONNECT_TIMEOUT_MS,
        commandTimeout: this.commandTimeoutMs,
        maxRetriesPerRequest: REDIS_CONFIG.MAX_RETRIES_PER_REQ,
        retryStrategy: () => null, // Sin bucles infinitos de reconexión: el circuit breaker gobierna
        enableOfflineQueue: false, // Fall-fast when disconnected
        lazyConnect: true,
      });

      this.client.on('error', (err) => {
        this.logger.warn(`Error en cliente Redis: ${err.message}`);
        this.handleFailure();
      });

      // Intento de conexión no bloqueante
      this.client.connect().catch((err) => {
        this.logger.warn(`No se pudo conectar a Redis en el arranque: ${err.message}`);
        this.handleFailure();
      });
    } catch (err: any) {
      this.logger.error(`Error inicializando cliente Redis: ${err.message}`);
      this.client = null;
    }
  }

  /** Retorna true si Redis está configurado y el circuit breaker no está abierto. */
  isAvailable(): boolean {
    if (!this.client) {
      return false;
    }

    if (this.circuitState === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.cooldownMs) {
        this.circuitState = 'HALF_OPEN';
        this.logger.log('Circuit breaker Redis pasó a estado HALF_OPEN (probando recuperación)');
        return true;
      }
      return false;
    }

    return true;
  }

  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Ejecuta el script Lua atómico para purgar vencidos, insertar el evento actual y contar vigentes.
   * Si Redis no está disponible o falla, retorna `null`, indicando que el llamador debe degradar.
   */
  async recordAndCount(
    userId: string,
    event: { idTxn: string; receivedAt: number },
    windowMs: number,
  ): Promise<RedisWindowResult | null> {
    if (!this.isAvailable()) {
      this.metrics.increment(METRIC.REDIS_DEGRADED);
      return null;
    }

    const key = `${REDIS_KEY_PREFIX}${userId}`;
    const minTime = event.receivedAt - windowMs;
    const ttlSeconds = Math.max(10, Math.ceil((windowMs / 1000) * 2));

    try {
      this.metrics.increment(METRIC.REDIS_OPERATIONS);
      const rawCount = await this.client!.eval(
        SLIDING_WINDOW_LUA_SCRIPT,
        1,
        key,
        event.idTxn,
        event.receivedAt.toString(),
        minTime.toString(),
        ttlSeconds.toString(),
      );

      this.handleSuccess();
      const count = typeof rawCount === 'number' ? rawCount : parseInt(String(rawCount), 10);

      return {
        count,
        source: 'redis',
        isDegraded: false,
      };
    } catch (err: any) {
      this.logger.warn(`Fallo al evaluar ventana en Redis para usuario ${userId}: ${err.message}`);
      this.handleFailure();
      this.metrics.increment(METRIC.REDIS_DEGRADED);
      return null;
    }
  }

  /**
   * Reconstruye la ventana en Redis de un usuario utilizando únicamente eventos activos
   * provistos por la fuente durable (PostgreSQL: receivedAt >= now - windowMs).
   */
  async reconstructActiveWindow(
    userId: string,
    activeEvents: Array<{ idTxn: string; receivedAt: number }>,
    windowMs: number,
  ): Promise<boolean> {
    if (!this.client || this.circuitState === 'OPEN') {
      return false;
    }

    const key = `${REDIS_KEY_PREFIX}${userId}`;
    const ttlSeconds = Math.max(10, Math.ceil((windowMs / 1000) * 2));

    try {
      const pipeline = this.client.pipeline();
      // Limpiar estado previo
      pipeline.del(key);

      if (activeEvents.length > 0) {
        for (const ev of activeEvents) {
          pipeline.zadd(key, ev.receivedAt, ev.idTxn);
        }
        pipeline.expire(key, ttlSeconds);
      }

      await pipeline.exec();
      this.metrics.increment(METRIC.REDIS_RECONSTRUCTIONS);
      this.handleSuccess();
      return true;
    } catch (err: any) {
      this.logger.warn(`Error reconstruyendo ventana Redis para usuario ${userId}: ${err.message}`);
      this.handleFailure();
      return false;
    }
  }

  private handleSuccess(): void {
    if (this.circuitState === 'HALF_OPEN') {
      this.logger.log('Circuit breaker Redis restablecido a CLOSED');
    }
    this.circuitState = 'CLOSED';
    this.consecutiveFailures = 0;
  }

  private handleFailure(): void {
    this.metrics.increment(METRIC.REDIS_ERRORS);
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.consecutiveFailures >= this.failureThreshold && this.circuitState !== 'OPEN') {
      this.circuitState = 'OPEN';
      this.metrics.increment(METRIC.REDIS_CIRCUIT_OPEN);
      this.logger.error(
        `Circuit breaker Redis ABIERTO tras ${this.consecutiveFailures} fallos consecutivos. Operando en modo degradado.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
      this.client = null;
    }
  }
}

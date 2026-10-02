import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  APPRESSO_REJECT_ORIGIN_HEADER,
  APPRESSO_THROTTLER_REJECTED_HEADER,
  RejectOrigin,
  resolveAppressoThrottleLimit,
  resolveAppressoThrottleTtl,
} from '../appresso.constants';
import { AppressoMetricsService, METRIC } from '../metrics/appresso-metrics.service';

interface CounterWindow {
  count: number;
  resetAt: number;
}

/**
 * Limitador dedicado a la ingesta de Appresso (A1.4).
 *
 * Por qué un guard propio en lugar del `ThrottlerGuard` global:
 *
 * 1. El guard global (120 peticiones / 60 s) protege `academic-analysis` y `structures`, y el
 *    enunciado exige que esa protección **no se degrade**. Subir el límite global para que el
 *    bot llegue al detector sería cambiar la protección de otros módulos por un módulo ajeno.
 * 2. El bot necesita un límite propio, conocido y acordable, para que el punto de saturación
 *    medido sea el del detector y no el del limitador.
 *
 * Por eso los controladores de Appresso están marcados con `@SkipThrottle()` a nivel de clase
 * (el guard global los ignora) y este guard se aplica de forma explícita únicamente sobre la
 * ruta de ingesta. Los endpoints de consulta quedan fuera del limitador de escritura para no
 * devolver 429 mientras se recoge evidencia.
 *
 * Implementación: ventana fija en memoria por clave `(ip, ruta)`. Es deliberadamente simple y
 * suficiente para un proceso único. Si el servicio se replica, el contador pasa a ser por
 * instancia y la limitación se vuelve aproximada: ese límite se documenta en el README de
 * persistencia junto con la necesidad de un almacén compartido en la Ola 2.
 */
@Injectable()
export class AppressoThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(AppressoThrottlerGuard.name);
  private readonly windows = new Map<string, CounterWindow>();

  /** Se poda el mapa cuando supera este tamaño para que la memoria no crezca sin límite. */
  private static readonly MAX_TRACKED_KEYS = 10000;

  constructor(private readonly metrics: AppressoMetricsService) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const limit = resolveAppressoThrottleLimit();
    const ttl = resolveAppressoThrottleTtl();
    const key = this.buildKey(request);

    const now = Date.now();
    const current = this.windows.get(key);

    if (!current || now >= current.resetAt) {
      this.pruneIfNeeded(now);
      this.windows.set(key, { count: 1, resetAt: now + ttl });
      this.stamp(response, RejectOrigin.NONE, false);
      return true;
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000),
      );
      response.setHeader('Retry-After', String(retryAfterSeconds));
      this.stamp(response, RejectOrigin.THROTTLER, true);
      this.metrics.increment(METRIC.REJECTED_BY_THROTTLER);

      this.logger.warn(
        `Petición rechazada por el limitador dedicado de Appresso: clave=${key} ` +
          `conteo=${current.count}/${limit} ttl=${ttl}ms`,
      );
      throw new ThrottlerException(
        'Límite de peticiones de Appresso excedido. El rechazo proviene del limitador HTTP, no del detector de anomalías.',
      );
    }

    current.count += 1;
    this.stamp(response, RejectOrigin.NONE, false);
    return true;
  }

  private buildKey(request: Request): string {
    const ip =
      (request as Request & { ip?: string }).ip ??
      request.socket?.remoteAddress ??
      'unknown';
    const path = request.route?.path
      ? `${request.baseUrl ?? ''}${request.route.path}`
      : request.path;
    return `${ip}|${path}`;
  }

  /**
   * Fija las cabeceras de origen antes de que la respuesta salga.
   *
   * Los guards se ejecutan **antes** que los interceptores en el ciclo de NestJS, así que si el
   * guard rechaza, ningún interceptor llega a ejecutarse: las cabeceras deben escribirse aquí.
   */
  private stamp(response: Response, origin: RejectOrigin, throttled: boolean): void {
    response.setHeader(APPRESSO_REJECT_ORIGIN_HEADER, origin);
    response.setHeader(
      APPRESSO_THROTTLER_REJECTED_HEADER,
      throttled ? 'true' : 'false',
    );
  }

  private pruneIfNeeded(now: number): void {
    if (this.windows.size < AppressoThrottlerGuard.MAX_TRACKED_KEYS) {
      return;
    }
    for (const [key, window] of this.windows.entries()) {
      if (now >= window.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}
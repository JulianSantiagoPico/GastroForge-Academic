import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap, catchError, throwError } from 'rxjs';
import {
  APPRESSO_ENDPOINT_TRANSACTIONS,
  APPRESSO_REJECT_ORIGIN_HEADER,
  APPRESSO_TEST_TRACE_HEADER,
  APPRESSO_THROTTLER_REJECTED_HEADER,
  RejectOrigin,
} from '../appresso.constants';
import { AppressoMetricsService, METRIC } from '../metrics/appresso-metrics.service';

/**
 * Clasifica el origen de toda respuesta de Appresso y lo publica en cabeceras y métricas (A1.5).
 *
 * El motivo es concreto: durante la carga controlada un `429` del limitador es indistinguible de
 * una anomalía de negocio si solo se mira el código HTTP. Con `x-appresso-reject-origin` el
 * reporte distingue `throttler` de `endpoint` y el punto de quiebre atribuido al detector es el
 * del detector.
 *
 * Los guards corren antes que los interceptores, así que un rechazo del limitador ya trae sus
 * cabeceras escritas por `AppressoThrottlerGuard`. Aquí solo se completa lo que falte.
 */
@Injectable()
export class AppressoRejectOriginInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AppressoRejectOriginInterceptor.name);

  constructor(private readonly metrics: AppressoMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    this.echoTestTraceHeader(request, response);
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.stamp(response, RejectOrigin.NONE, false);
        this.metrics.increment(METRIC.REQUESTS_RECEIVED);
        this.metrics.observeLatency(
          APPRESSO_ENDPOINT_TRANSACTIONS,
          Date.now() - startedAt,
        );
      }),
      catchError((error: unknown) => {
        const status = resolveStatus(error);
        const origin = classifyByStatus(status);

        this.stamp(response, origin, origin === RejectOrigin.THROTTLER);
        this.metrics.increment(METRIC.REQUESTS_RECEIVED);
        this.metrics.increment(counterForOrigin(origin));

        return throwError(() => error);
      }),
    );
  }

  /**
   * Eco de la cabecera de traza `x-appresso-test`.
   *
   * Deliberadamente **no** modifica el conteo ni salta ninguna comprobación: sirve para que el
   * cliente de carga pueda etiquetar sus peticiones en el reporte. Un bypass por cabecera sería
   * explotable por cualquier cliente.
   */
  private echoTestTraceHeader(request: Request, response: Response): void {
    const value = request.headers[APPRESSO_TEST_TRACE_HEADER];
    if (typeof value !== 'string' || value.length === 0) {
      return;
    }
    response.setHeader(APPRESSO_TEST_TRACE_HEADER, 'true');
    this.logger.debug(
      `Petición etiquetada como traza de prueba (sin efecto sobre el limitador): ${request.method} ${request.path}`,
    );
  }

  private stamp(response: Response, origin: RejectOrigin, throttled: boolean): void {
    if (!response.headersSent) {
      if (!response.getHeader(APPRESSO_REJECT_ORIGIN_HEADER)) {
        response.setHeader(APPRESSO_REJECT_ORIGIN_HEADER, origin);
      }
      if (!response.getHeader(APPRESSO_THROTTLER_REJECTED_HEADER)) {
        response.setHeader(
          APPRESSO_THROTTLER_REJECTED_HEADER,
          throttled ? 'true' : 'false',
        );
      }
    }
  }
}

/** Extrae el código HTTP de un error lanzado dentro del endpoint. */
function resolveStatus(error: unknown): number {
  if (error instanceof HttpException) {
    return error.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/** Traduce el código HTTP al origen semántico del rechazo. */
function classifyByStatus(status: number): RejectOrigin {
  if (status === HttpStatus.TOO_MANY_REQUESTS) {
    return RejectOrigin.THROTTLER;
  }
  if (status === HttpStatus.BAD_REQUEST) {
    return RejectOrigin.VALIDATION;
  }
  if (
    status === HttpStatus.UNAUTHORIZED ||
    status === HttpStatus.FORBIDDEN
  ) {
    return RejectOrigin.HMAC;
  }
  return RejectOrigin.ENDPOINT;
}

/** Contador asociado a cada origen de rechazo. */
function counterForOrigin(origin: RejectOrigin): string {
  switch (origin) {
    case RejectOrigin.THROTTLER:
      return METRIC.REJECTED_BY_THROTTLER;
    case RejectOrigin.VALIDATION:
      return METRIC.REJECTED_BY_VALIDATION;
    case RejectOrigin.HMAC:
      return METRIC.REJECTED_BY_HMAC;
    default:
      return METRIC.REJECTED_BY_ENDPOINT;
  }
}
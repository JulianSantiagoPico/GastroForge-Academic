/**
 * Constantes de contrato del módulo Appresso.
 *
 * Se centralizan aquí para que el detector puro, los servicios, el limitador dedicado y el
 * script de carga compartan exactamente los mismos valores. Cambiar la ventana o el umbral en
 * un solo lugar evita que la medición de carga y la regla de negocio diverjan.
 */

/** Ancho de la ventana deslizante por defecto en milisegundos. */
export const APPRESSO_WINDOW_MS = 3000;

/** Ventana efectiva de detección, configurable por entorno (APPRESSO_WINDOW_SECONDS o APPRESSO_WINDOW_MS). */
export function resolveAppressoWindowMs(): number {
  if (process.env.APPRESSO_WINDOW_SECONDS) {
    const sec = Number.parseInt(process.env.APPRESSO_WINDOW_SECONDS, 10);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  }
  if (process.env.APPRESSO_WINDOW_MS) {
    const ms = Number.parseInt(process.env.APPRESSO_WINDOW_MS, 10);
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return APPRESSO_WINDOW_MS;
}

/** Umbral de transacciones dentro de la ventana que dispara la regla de fraude. */
export const APPRESSO_THRESHOLD = 3;

/** Nombre estable de la regla de detección. */
export const APPRESSO_RULE_NAME = 'POSIBLE_FRAUDE';

/** Identificador del endpoint de ingestión usado como etiqueta en las métricas. */
export const APPRESSO_ENDPOINT_TRANSACTIONS = 'appresso.transactions';

/**
 * Origen de una respuesta no aceptada.
 *
 * Existe para que el reporte de carga nunca atribuya al detector un rechazo que en realidad
 * produjo el limitador HTTP (A1.5 / A6.3).
 */
export enum RejectOrigin {
  /** La petición fue aceptada. */
  NONE = 'none',
  /** Rechazo producido por el limitador dedicado de Appresso. */
  THROTTLER = 'throttler',
  /** Rechazo por DTO inválido (HTTP 400). */
  VALIDATION = 'validation',
  /** Rechazo por firma HMAC inválida o ausente (HTTP 401). */
  HMAC = 'hmac',
  /** Error no controlado dentro del endpoint de Appresso (HTTP 5xx). */
  ENDPOINT = 'endpoint',
}

/** Cabecera que declara el origen del rechazo o de la aceptación. */
export const APPRESSO_REJECT_ORIGIN_HEADER = 'x-appresso-reject-origin';

/** Cabecera booleana que indica si el limitador de Appresso rechazó la petición. */
export const APPRESSO_THROTTLER_REJECTED_HEADER = 'x-appresso-throttler-rejected';

/**
 * Cabecera de traza opcional que el cliente de prueba puede enviar.
 *
 * Solo produce eco y traza en logs. **No otorga ningún bypass**: no salta el limitador, no salta
 * la verificación HMAC ni la validación. Un bypass por cabecera sería un agujero de seguridad
 * trivial de explotar. Si alguna vez se requiere uno, debe ser una opción de configuración
 * acotada al entorno de prueba y jamás habilitable en producción.
 */
export const APPRESSO_TEST_TRACE_HEADER = 'x-appresso-test';

/** Límite por defecto de peticiones del limitador dedicado de Appresso. */
export const APPRESSO_THROTTLE_LIMIT_DEFAULT = 600;

/** Ventana por defecto del limitador dedicado de Appresso, en milisegundos. */
export const APPRESSO_THROTTLE_TTL_DEFAULT = 60000;

/** Límite efectivo del limitador dedicado, configurable por entorno. */
export function resolveAppressoThrottleLimit(): number {
  const raw = process.env.APPRESSO_THROTTLE_LIMIT;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : APPRESSO_THROTTLE_LIMIT_DEFAULT;
}

/** Ventana efectiva del limitador dedicado, configurable por entorno. */
export function resolveAppressoThrottleTtl(): number {
  const raw = process.env.APPRESSO_THROTTLE_TTL;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : APPRESSO_THROTTLE_TTL_DEFAULT;
}
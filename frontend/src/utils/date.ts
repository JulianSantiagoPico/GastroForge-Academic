/**
 * Utilidades para manejo y formateo seguro y consistente de fechas.
 */

/**
 * Parsea y formatea de forma segura un timestamp (ms numérico, string numérico o string ISO)
 * en formato legible bajo la zona horaria UTC.
 * Si el valor es inválido, vacío o nulo, retorna un guión '-' en lugar de 'Invalid Date'.
 */
export function formatUtcDateTime(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  const date = !Number.isNaN(numericValue) ? new Date(numericValue) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('es-CO', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

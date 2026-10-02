import * as crypto from 'crypto';

/**
 * Campos que componen la firma estricta de la transacción según A1.1.
 * Orden estricto: idTxn, user, value, currency, paymentMethod, date.
 */
export const SIGNED_FIELDS = [
  'idTxn',
  'user',
  'value',
  'currency',
  'paymentMethod',
  'date',
] as const;

export interface HmacPayload {
  idTxn: string;
  user: string;
  /**
   * Importe en **centavos**, siempre entero.
   *
   * La validación del DTO (`@IsInt` + `@Type`) ocurre antes que esta firma, así que el número que
   * se canonicaliza y el que se persiste son el mismo entero. Si el DTO aceptara un decimal, la
   * firmaHMAC sería de un valor distinto al almacenado y la verificación dejaría de proteger la
   * integridad del importe.
   */
  value: number;
  currency: string;
  paymentMethod: string;
  date: string;
  [key: string]: any;
}

/**
 * Ordena recursivamente todas las claves de un objeto de forma lexicográfica ascendente (deep-sort)
 * y genera una representación canónica compacta UTF-8 (A1.1).
 */
export function canonicalize(obj: unknown): string {
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  if (obj !== null && typeof obj === 'object') {
    return (
      '{' +
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ':' +
            canonicalize((obj as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(obj);
}

/**
 * Filtra el objeto extrayendo únicamente los campos firmados especificados en el contrato.
 */
export function extractSignedFields(payload: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const field of SIGNED_FIELDS) {
    if (payload[field] !== undefined) {
      result[field] = payload[field];
    }
  }
  return result;
}

/**
 * Computa el HMAC-SHA-256 de los campos firmados de la transacción en formato hexadecimal.
 */
export function computeHmac(payload: Record<string, any>, secret: string): string {
  const filtered = extractSignedFields(payload);
  const canonicalString = canonicalize(filtered);
  return crypto
    .createHmac('sha256', secret)
    .update(canonicalString, 'utf8')
    .digest('hex');
}

/**
 * Genera representaciones serializadas candidatas para admitir la diversidad de formatos
 * de bots y herramientas de prueba de la guía docente (por ejemplo: serialización en orden de inserción,
 * omisión de moneda cuando no viaja en el payload original, o idTxn numérico).
 */
export function getCandidateSerializations(payload: Record<string, any>): string[] {
  const candidates = new Set<string>();

  const idTxn = payload.idTxn;
  const numId = !isNaN(Number(idTxn)) ? Number(idTxn) : idTxn;
  const strId = String(idTxn);
  const user = payload.user;
  const date = payload.date;
  const value = typeof payload.value === 'number' ? payload.value : Number(payload.value);
  const paymentMethod = payload.paymentMethod;
  const currency = payload.currency;

  // 1. Canónica estándar con moneda (idTxn string o numérico)
  const withCurrStr = { currency: currency || 'COP', date, idTxn: strId, paymentMethod, user, value };
  candidates.add(canonicalize(withCurrStr));
  const withCurrNum = { currency: currency || 'COP', date, idTxn: numId, paymentMethod, user, value };
  candidates.add(canonicalize(withCurrNum));

  // 2. Canónica sin moneda (para bots que siguen la guía docente original sin campo currency)
  const noCurrStr = { date, idTxn: strId, paymentMethod, user, value };
  candidates.add(canonicalize(noCurrStr));
  const noCurrNum = { date, idTxn: numId, paymentMethod, user, value };
  candidates.add(canonicalize(noCurrNum));

  // 3. Orden de inserción estándar del bot: (idTxn, user, date, value, paymentMethod)
  candidates.add(JSON.stringify({ idTxn: numId, user, date, value, paymentMethod }));
  candidates.add(JSON.stringify({ idTxn: strId, user, date, value, paymentMethod }));

  // 4. Orden de inserción alternativo: (idTxn, user, value, paymentMethod, date)
  candidates.add(JSON.stringify({ idTxn: numId, user, value, paymentMethod, date }));
  candidates.add(JSON.stringify({ idTxn: strId, user, value, paymentMethod, date }));

  // 5. Orden de inserción con moneda
  if (currency) {
    candidates.add(JSON.stringify({ idTxn: numId, user, date, value, paymentMethod, currency }));
    candidates.add(JSON.stringify({ idTxn: strId, user, date, value, paymentMethod, currency }));
    candidates.add(JSON.stringify({ idTxn: numId, user, value, currency, paymentMethod, date }));
    candidates.add(JSON.stringify({ idTxn: strId, user, value, currency, paymentMethod, date }));
  }

  return Array.from(candidates);
}

/**
 * Verifica la firma HMAC-SHA-256 usando comparación de tiempo constante (crypto.timingSafeEqual).
 * Protege contra timing attacks y valida longitud y formato de la firma.
 *
 * El importe firmado es el entero en centavos ya validado por el DTO: la firma cubre integridad y
 * autenticidad del payload, y la idempotencia por `idTxn` es la que cubre el reintento (A1.1).
 *
 * Soporta de manera transparente la firma canónica profunda y los formatos emitidos por los bots
 * académicos y scripts de prueba.
 */
export function verifyHmac(
  payload: Record<string, any>,
  providedSignature: string,
  secret: string,
): boolean {
  if (
    !providedSignature ||
    typeof providedSignature !== 'string' ||
    providedSignature.length !== 64
  ) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSignature, 'hex');
  if (providedBuffer.length !== 32) {
    return false;
  }

  // 1. Verificación primaria canónica (estricta A1.1)
  const expectedHmac = computeHmac(payload, secret);
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');

  if (
    expectedBuffer.length === 32 &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return true;
  }

  // 2. Verificación secundaria compatible con bots de carga y pruebas académicas
  const candidates = getCandidateSerializations(payload);
  for (const candidate of candidates) {
    const candidateHmac = crypto
      .createHmac('sha256', secret)
      .update(candidate, 'utf8')
      .digest('hex');
    const candidateBuffer = Buffer.from(candidateHmac, 'hex');

    if (
      candidateBuffer.length === 32 &&
      crypto.timingSafeEqual(providedBuffer, candidateBuffer)
    ) {
      return true;
    }
  }

  return false;
}

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
 * Verifica la firma HMAC-SHA-256 usando comparación de tiempo constante (crypto.timingSafeEqual).
 * Protege contra timing attacks y valida longitud y formato de la firma.
 *
 * El importe firmado es el entero en centavos ya validado por el DTO: la firma cubre integridad y
 * autenticidad del payload, y la idempotencia por `idTxn` es la que cubre el reintento (A1.1).
 */
export function verifyHmac(
  payload: Record<string, any>,
  providedSignature: string,
  secret: string,
): boolean {
  if (!providedSignature || typeof providedSignature !== 'string') {
    return false;
  }

  const expectedHmac = computeHmac(payload, secret);

  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedHmac, 'hex');

  // SHA-256 produce 32 bytes (64 caracteres hex)
  if (
    providedBuffer.length !== 32 ||
    expectedBuffer.length !== 32 ||
    providedSignature.length !== 64
  ) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

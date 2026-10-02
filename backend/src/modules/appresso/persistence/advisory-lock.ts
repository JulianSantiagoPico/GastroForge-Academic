import * as crypto from 'crypto';

/**
 * Derivación de la clave de `pg_advisory_xact_lock` a partir del identificador de usuario (A3.5).
 *
 * Dos detalles importan aquí:
 *
 * 1. **Estabilidad.** La clave debe ser la misma en todas las réplicas y en todas las llamadas,
 *    así que se deriva con SHA-256 del `userId` y no con el código hash de una función interna
 *    del motor. `hashtext()` depende de la versión de PostgreSQL y de la configuración regional
 *    del servidor: dos entornos distintos pueden producir claves distintas para el mismo
 *    usuario, que es exactamente el fallo que el bloqueo necesita evitar.
 * 2. **Rango.** PostgreSQL espera un entero de 64 bits con signo para la variante de un solo
 *    argumento. Se toma el primer bloque de 32 bits del digest y se reduce módulo $2^{31}-1$ para
 *    obtener siempre un entero no negativo y representable sin ambigüedad en JavaScript.
 *
 * La probabilidad de colisión entre dos usuarios distintos es la de un hash de 31 bits. Es
 * deliberadamente una colisión tolerable y no una corrección: una colisión solo provoca que dos
 * usuarios distintos se bloqueen mutuamente durante unos milisegundos. Jamás provoca que dos
 * usuarios **distintos** compartan conteo, porque el estado del detector sigue indexado por
 * `userId` y no por la clave del lock.
 */
export function advisoryLockKeyFor(userId: string): number {
  const digest = crypto.createHash('sha256').update(userId, 'utf8').digest();
  return digest.readUInt32BE(0) % 2147483647;
}

/** Sentencia usada para serializar el procesamiento de un usuario dentro de la transacción. */
export const ADVISORY_LOCK_STATEMENT =
  'SELECT pg_advisory_xact_lock($1::bigint)';
/**
 * Serialización por clave para operaciones asíncronas dentro de un mismo proceso.
 *
 * Existe para el modo in-memory de Appresso. En PostgreSQL la serialización por usuario la
 * garantiza `pg_advisory_xact_lock`, que es del lado del servidor y por tanto válida entre
 * réplicas. Sin base de datos no hay servidor: dos peticiones concurrentes del mismo usuario
 * podrían evaluar la ventana sobre el mismo estado antes de que ninguna escriba, y perderse el
 * cruce de umbral (A3.5).
 *
 * Implementación: cadena de promesas por clave. Cada llamada espera a la anterior de la **misma**
 * clave y a ninguna de las demás, de modo que usuarios distintos nunca se bloquean entre sí. El
 * costo por operación es O(1) en número de claves activas y la memoria se libera en cuanto la
 * última llamada de una clave termina.
 */
interface MutexChain {
  /** Puerta de la última operación encolada. Quien llega espera a la que la precede. */
  tail: Promise<void>;
  /** Operaciones en curso más las que esperan turno. */
  waiters: number;
}

export class KeyedMutex {
  private readonly chains = new Map<string, MutexChain>();

  /**
   * Ejecuta `task` garantizando que ninguna otra tarea de la misma clave se ejecute
   * simultáneamente.
   *
   * La liberación ocurre siempre en `finally`, incluso si la tarea lanza: una operación fallida
   * no puede dejar la clave bloqueada para las siguientes.
   */
  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    let chain = this.chains.get(key);
    if (!chain) {
      chain = { tail: Promise.resolve(), waiters: 0 };
      this.chains.set(key, chain);
    }
    chain.waiters += 1;

    const previousTail = chain.tail;

    let release: () => void = () => undefined;
    chain.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    // El resultado de la operación previa se ignora a propósito: si una llamada anterior falla,
    // la siguiente debe poder ejecutarse igualmente en lugar de quedar envenenada.
    await previousTail.then(
      () => undefined,
      () => undefined,
    );

    try {
      return await task();
    } finally {
      release();
      chain.waiters -= 1;
      // La comprobación de identidad evita que una cadena ya retirada borre la que la sustituyó.
      if (chain.waiters === 0 && this.chains.get(key) === chain) {
        this.chains.delete(key);
      }
    }
  }

  /** Número de claves con operaciones en curso o en espera. Pensado para pruebas. */
  get activeKeys(): number {
    return this.chains.size;
  }
}
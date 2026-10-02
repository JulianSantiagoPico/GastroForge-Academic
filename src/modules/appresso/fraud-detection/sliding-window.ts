/**
 * Representa un evento individual recibido para evaluación en la ventana deslizante.
 */
export interface WindowEvent {
  idTxn: string;
  userId: string;
  receivedAt: number;
  value?: number;
  currency?: string;
  paymentMethod?: string;
  date?: string;
}

/**
 * Configuración para el detector de ventana deslizante.
 */
export interface SlidingWindowConfig {
  windowMs: number;
  threshold: number;
  ruleName?: string;
}

/**
 * Resultado estructurado e inmutable de la evaluación de la ventana deslizante.
 */
export interface WindowEvaluationResult {
  userId: string;
  currentEvent: WindowEvent;
  windowMs: number;
  count: number;
  threshold: number;
  isAnomaly: boolean;
  rule: string;
  isDuplicate: boolean;
  windowEvents: WindowEvent[];
}

/**
 * Nodo para la cola FIFO interna optimizada para tiempo constante O(1).
 */
class QueueNode<T> {
  value: T;
  next: QueueNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/**
 * Cola FIFO de alta eficiencia con operaciones O(1) estrictas.
 */
class FastQueue<T> {
  private head: QueueNode<T> | null = null;
  private tail: QueueNode<T> | null = null;
  private _size = 0;

  enqueue(item: T): void {
    const node = new QueueNode(item);
    if (!this.tail) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this._size++;
  }

  dequeue(): T | undefined {
    if (!this.head) {
      return undefined;
    }
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) {
      this.tail = null;
    }
    this._size--;
    return value;
  }

  peek(): T | undefined {
    return this.head ? this.head.value : undefined;
  }

  size(): number {
    return this._size;
  }

  toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.value);
      current = current.next;
    }
    return result;
  }
}

/**
 * Estado en memoria de la ventana deslizante para un usuario específico.
 */
interface UserWindowState {
  queue: FastQueue<WindowEvent>;
  seenTxnIds: Set<string>;
  lastReceivedAt: number;
}

/**
 * Detector de ventana deslizante pura y determinista (A2.1 - A2.4).
 *
 * Principios:
 * 1. Pura y sin lectura del reloj del sistema: el tiempo es provisto explícitamente en cada evento (`receivedAt`).
 * 2. Complejidad amortizada O(1) por evento: cada evento se encola una sola vez y se desencola una sola vez.
 * 3. Borde temporal inclusivo: eventos con `receivedAt >= now - windowMs` pertenecen a la ventana;
 *    eventos con `receivedAt < now - windowMs` se purgan.
 * 4. Aislamiento por usuario y detección de reintentos mediante idempotencia por `idTxn`.
 */
export class SlidingWindowDetector {
  private readonly windowMs: number;
  private readonly threshold: number;
  private readonly ruleName: string;
  private readonly userWindows = new Map<string, UserWindowState>();

  constructor(config: SlidingWindowConfig) {
    this.windowMs = config.windowMs;
    this.threshold = config.threshold;
    this.ruleName = config.ruleName ?? 'POSIBLE_FRAUDE';
  }

  /**
   * Obtiene o inicializa el estado de la ventana para un usuario.
   */
  private getOrCreateUserState(userId: string): UserWindowState {
    let state = this.userWindows.get(userId);
    if (!state) {
      state = {
        queue: new FastQueue<WindowEvent>(),
        seenTxnIds: new Set<string>(),
        lastReceivedAt: 0,
      };
      this.userWindows.set(userId, state);
    }
    return state;
  }

  /**
   * Purga de la cabeza de la cola todos los eventos cuyo tiempo sea estrictamente menor que `minTime`.
   * Complejidad: O(k) donde k es el número de eventos vencidos, con costo amortizado O(1).
   */
  private purgeExpired(state: UserWindowState, minTime: number): void {
    while (state.queue.peek() !== undefined && state.queue.peek()!.receivedAt < minTime) {
      state.queue.dequeue();
    }
  }

  /**
   * Procesa un evento entrante y evalúa la regla de detección.
   */
  processEvent(event: WindowEvent): WindowEvaluationResult {
    const state = this.getOrCreateUserState(event.userId);

    // 1. Detección de duplicado / idempotencia
    if (state.seenTxnIds.has(event.idTxn)) {
      this.purgeExpired(state, event.receivedAt - this.windowMs);
      const count = state.queue.size();
      return {
        userId: event.userId,
        currentEvent: event,
        windowMs: this.windowMs,
        count,
        threshold: this.threshold,
        isAnomaly: count >= this.threshold,
        rule: this.ruleName,
        isDuplicate: true,
        windowEvents: state.queue.toArray(),
      };
    }

    // 2. Validación de orden temporal monotónico
    if (event.receivedAt < state.lastReceivedAt) {
      throw new Error(
        `Evento fuera de orden: receivedAt (${event.receivedAt}) < último recibido (${state.lastReceivedAt}) para usuario ${event.userId}`,
      );
    }

    state.lastReceivedAt = event.receivedAt;
    state.seenTxnIds.add(event.idTxn);

    // 3. Purgar eventos fuera de la ventana: minTime = now - W
    // El evento exactamente en now - W se conserva porque su receivedAt == minTime (no es < minTime)
    const minTime = event.receivedAt - this.windowMs;
    this.purgeExpired(state, minTime);

    // 4. Encolar el nuevo evento
    state.queue.enqueue(event);

    // 5. Evaluar umbral
    const count = state.queue.size();
    const isAnomaly = count >= this.threshold;

    return {
      userId: event.userId,
      currentEvent: event,
      windowMs: this.windowMs,
      count,
      threshold: this.threshold,
      isAnomaly,
      rule: this.ruleName,
      isDuplicate: false,
      windowEvents: state.queue.toArray(),
    };
  }

  /**
   * Consulta el número de eventos vigentes en la ventana para un usuario en un instante dado.
   */
  getWindowCount(userId: string, atTime: number): number {
    const state = this.userWindows.get(userId);
    if (!state) {
      return 0;
    }
    this.purgeExpired(state, atTime - this.windowMs);
    return state.queue.size();
  }

  /**
   * Limpia el estado de todos los usuarios (útil para pruebas y reinicio).
   */
  reset(): void {
    this.userWindows.clear();
  }
}

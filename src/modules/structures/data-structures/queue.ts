/**
 * Nodo para la lista enlazada de la cola FIFO.
 */
class QueueNode<T> {
  value: T;
  next: QueueNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/**
 * Cola FIFO (First-In, First-Out) implementada mediante lista enlazada simple.
 *
 * Justificación académica:
 * A diferencia de un arreglo convencional que requiere `Array.shift()` (con costo O(n) por reindexación),
 * la lista enlazada garantiza tiempo constante O(1) estricto tanto en inserción al final (`enqueue`)
 * como en extracción al frente (`dequeue`) y consulta (`peek`).
 */
export class Queue<T> {
  private head: QueueNode<T> | null = null;
  private tail: QueueNode<T> | null = null;
  private _size = 0;

  /**
   * Encola un elemento al final de la cola.
   * Complejidad: O(1)
   */
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

  /**
   * Extrae y retorna el primer elemento de la cola.
   * Complejidad: O(1)
   */
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

  /**
   * Consulta el primer elemento sin extraerlo.
   * Complejidad: O(1)
   */
  peek(): T | undefined {
    return this.head ? this.head.value : undefined;
  }

  /**
   * Retorna el número de elementos en la cola.
   * Complejidad: O(1)
   */
  size(): number {
    return this._size;
  }

  /**
   * Indica si la cola está vacía.
   * Complejidad: O(1)
   */
  isEmpty(): boolean {
    return this._size === 0;
  }

  /**
   * Retorna una copia de los elementos en orden FIFO como un arreglo.
   * Complejidad: O(n)
   */
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

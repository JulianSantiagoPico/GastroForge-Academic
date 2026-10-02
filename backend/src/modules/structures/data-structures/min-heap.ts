/**
 * Comparador para elementos del heap. Retorna:
 *  - un número negativo si a tiene mayor prioridad que b (a < b en min-heap).
 *  - cero si son equivalentes.
 *  - un número positivo si b tiene mayor prioridad que a.
 */
export type HeapComparator<T> = (a: T, b: T) => number;

/**
 * Montículo binario genérico (Min-Heap).
 *
 * Justificación académica:
 * Resuelve la selección repetida del elemento óptimo en tiempo O(log n) tanto en inserción
 * como en extracción, manteniendo la propiedad de montículo donde cada nodo padre es menor o igual
 * que sus hijos. Evita ordenar la colección completa con O(n log n) tras cada nuevo arribo.
 */
export class MinHeap<T> {
  private heap: T[] = [];

  constructor(
    private comparator: HeapComparator<T> = (a: any, b: any) =>
      a < b ? -1 : a > b ? 1 : 0
  ) {}

  private parentIndex(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftChildIndex(i: number): number {
    return 2 * i + 1;
  }

  private rightChildIndex(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  /**
   * Inserta un elemento y reestablece la propiedad del heap hacia arriba.
   * Complejidad: O(log n)
   */
  insert(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Reubica un elemento hacia arriba en el árbol si tiene menor valor que su padre.
   * Complejidad: O(log n)
   */
  bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = this.parentIndex(current);
      if (this.comparator(this.heap[current], this.heap[parent]) < 0) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  /**
   * Extrae y retorna el elemento con menor valor (raíz del montículo).
   * Complejidad: O(log n)
   */
  extractMin(): T | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    if (this.heap.length === 1) {
      return this.heap.pop();
    }
    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  /**
   * Reubica un elemento hacia abajo en el árbol si sus hijos tienen menor valor.
   * Complejidad: O(log n)
   */
  bubbleDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (this.leftChildIndex(current) < length) {
      let smallest = current;
      const left = this.leftChildIndex(current);
      const right = this.rightChildIndex(current);

      if (left < length && this.comparator(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }

      if (right < length && this.comparator(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== current) {
        this.swap(current, smallest);
        current = smallest;
      } else {
        break;
      }
    }
  }

  /**
   * Consulta el elemento mínimo (raíz) sin extraerlo.
   * Complejidad: O(1)
   */
  peek(): T | undefined {
    return this.heap.length > 0 ? this.heap[0] : undefined;
  }

  /**
   * Retorna el número de elementos contenidos en el heap.
   * Complejidad: O(1)
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Indica si el heap está vacío.
   * Complejidad: O(1)
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Retorna una copia del arreglo interno que representa el árbol del heap.
   * Complejidad: O(n)
   */
  toArray(): T[] {
    return [...this.heap];
  }
}

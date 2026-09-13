/**
 * Pila genérica LIFO (Last-In, First-Out).
 *
 * Justificación académica:
 * Permite gestionar historiales de cambios y reversibilidad de acciones (Undo / Redo).
 * Todas las operaciones sobre el tope de la pila se ejecutan en tiempo constante O(1).
 */
export class Stack<T> {
  private items: T[] = [];

  /**
   * Apila un elemento en el tope.
   * Complejidad: O(1)
   */
  push(item: T): void {
    this.items.push(item);
  }

  /**
   * Desapila y retorna el elemento en el tope.
   * Complejidad: O(1)
   */
  pop(): T | undefined {
    return this.items.pop();
  }

  /**
   * Consulta el elemento en el tope sin retirarlo.
   * Complejidad: O(1)
   */
  peek(): T | undefined {
    return this.items.length > 0 ? this.items[this.items.length - 1] : undefined;
  }

  /**
   * Vacía todos los elementos de la pila.
   * Complejidad: O(1)
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Retorna el número de elementos en la pila.
   * Complejidad: O(1)
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Indica si la pila está vacía.
   * Complejidad: O(1)
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Retorna una copia de los elementos de la pila (del fondo al tope).
   * Complejidad: O(n)
   */
  toArray(): T[] {
    return [...this.items];
  }
}

import { AcademicOrder } from '../interfaces/academic-order.interface';

export interface LinearSearchResult {
  order: AcademicOrder | null;
  operations: number;
  targetPosition: number;
  found: boolean;
  elapsedMs: number;
  bestCase: string;
  worstCase: string;
}

/**
 * Realiza una búsqueda lineal sobre la lista de pedidos simulados.
 *
 * Operación contada: cada comparación evaluada en el bucle sobre la clave primaria id.
 * - Mejor caso O(1): el elemento está en la primera posición (1 operación).
 * - Caso promedio O(n): el elemento se encuentra cerca de la mitad (n / 2 operaciones).
 * - Peor caso O(n): el elemento está en la última posición o no existe (n operaciones).
 *
 * @param orders Lista de pedidos.
 * @param targetId Identificador del pedido buscado.
 * @param targetPosition Posición esperada (1-indexed) para reporte informativo.
 */
export function findOrderById(
  orders: AcademicOrder[],
  targetId: string,
  targetPosition = orders.length
): LinearSearchResult {
  const start = performance.now();
  let operations = 0;
  let foundOrder: AcademicOrder | null = null;
  let found = false;

  for (let i = 0; i < orders.length; i++) {
    operations++;
    if (orders[i].id === targetId) {
      foundOrder = orders[i];
      found = true;
      break;
    }
  }

  const end = performance.now();
  const elapsedMs = Number((end - start).toFixed(4));

  return {
    order: foundOrder,
    operations,
    targetPosition,
    found,
    elapsedMs,
    bestCase: 'O(1)',
    worstCase: 'O(n)',
  };
}

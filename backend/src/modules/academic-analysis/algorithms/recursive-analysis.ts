import { AcademicOrder } from '../interfaces/academic-order.interface';

export interface RecursiveAggregationResult {
  totalProducts: number;
  operations: number;
  maxDepth: number;
  elapsedMs: number;
  timeComplexity: string;
  spaceComplexity: string;
}

interface InternalRecursiveResult {
  total: number;
  operations: number;
  maxDepth: number;
}

function countProductsRecursiveInternal(
  orders: AcademicOrder[],
  start: number,
  end: number,
  currentDepth: number
): InternalRecursiveResult {
  const length = end - start;

  if (length === 0) {
    return { total: 0, operations: 0, maxDepth: currentDepth };
  }

  if (length === 1) {
    return {
      total: orders[start].totalProducts,
      operations: 1,
      maxDepth: currentDepth,
    };
  }

  const middle = Math.floor((start + end) / 2);
  const left = countProductsRecursiveInternal(orders, start, middle, currentDepth + 1);
  const right = countProductsRecursiveInternal(orders, middle, end, currentDepth + 1);

  return {
    total: left.total + right.total,
    operations: left.operations + right.operations,
    maxDepth: Math.max(left.maxDepth, right.maxDepth),
  };
}

/**
 * Calcula el total de productos procesados utilizando el paradigma Divide y Vencerás.
 *
 * Divide el rango de pedidos a la mitad recursivamente hasta subproblemas unitarios.
 * - Operaciones contadas: cada caso base unitario resuelto (suma y lectura). Total = n.
 * - Complejidad temporal: O(n) - visita cada nodo hoja una sola vez.
 * - Complejidad espacial: O(log n) en la pila de llamadas gracias a la división balanceada por mitades.
 *
 * @param orders Lista de pedidos.
 */
export function countProductsRecursive(orders: AcademicOrder[]): RecursiveAggregationResult {
  const start = performance.now();
  const res = countProductsRecursiveInternal(orders, 0, orders.length, 0);
  const end = performance.now();
  const elapsedMs = Number((end - start).toFixed(4));

  return {
    totalProducts: res.total,
    operations: res.operations,
    maxDepth: res.maxDepth,
    elapsedMs,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(log n)',
  };
}

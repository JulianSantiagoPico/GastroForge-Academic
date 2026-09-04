import { AcademicOrder } from '../interfaces/academic-order.interface';

export interface ProductAggregationResult {
  totalProducts: number;
  operations: number;
  elapsedMs: number;
  timeComplexity: string;
  spaceComplexity: string;
}

/**
 * Calcula la suma acumulada de productos procesados de forma iterativa.
 *
 * Operación contada: cada acceso y acumulación sobre el campo totalProducts.
 * - Complejidad temporal: O(n) - visita exactamente cada pedido una sola vez.
 * - Complejidad espacial: O(1) - utiliza únicamente variables escalares acumuladoras en memoria.
 *
 * @param orders Lista de pedidos a agregar.
 */
export function countProcessedProducts(orders: AcademicOrder[]): ProductAggregationResult {
  const start = performance.now();
  let totalProducts = 0;
  let operations = 0;

  for (let i = 0; i < orders.length; i++) {
    totalProducts += orders[i].totalProducts;
    operations++;
  }

  const end = performance.now();
  const elapsedMs = Number((end - start).toFixed(4));

  return {
    totalProducts,
    operations,
    elapsedMs,
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
  };
}

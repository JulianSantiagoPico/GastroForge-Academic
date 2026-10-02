import { AcademicOrder } from '../interfaces/academic-order.interface';

export const QUADRATIC_EXECUTION_LIMIT = 2000;

export interface QuadraticAnalysisResult {
  size: number;
  algorithm: string;
  timeComplexity: string;
  operations?: number;
  estimatedOperations?: number;
  executed: boolean;
  elapsedMs?: number;
  theoreticalFormula: string;
  reason?: string;
  duplicateCustomerPairsFound?: number;
}

/**
 * Realiza o estima la comparación cuadrática de pares de pedidos (i, j con j > i).
 *
 * El número total de comparaciones de pares únicos responde a la sumatoria:
 * (n - 1) + (n - 2) + ... + 1 = n * (n - 1) / 2
 *
 * Por salvaguarda de recursos del servidor:
 * - Para n <= 2000: Se ejecuta fácticamente el algoritmo midiendo operaciones reales.
 * - Para n > 2000: Se retorna la solución analítica exacta sin ejecutar el bucle destructivo.
 *
 * @param orders Lista de pedidos o tamaño si no se requiere ejecución física.
 * @param requestedSize Tamaño n consultado.
 */
export function analyzeQuadraticPairs(
  orders: AcademicOrder[],
  requestedSize: number
): QuadraticAnalysisResult {
  const theoreticalOperations = Math.floor((requestedSize * (requestedSize - 1)) / 2);

  if (requestedSize > QUADRATIC_EXECUTION_LIMIT) {
    return {
      size: requestedSize,
      algorithm: 'comparación de pares de pedidos',
      timeComplexity: 'O(n²)',
      estimatedOperations: theoreticalOperations,
      executed: false,
      theoreticalFormula: 'n * (n - 1) / 2',
      reason: 'El tamaño excede el límite seguro de ejecución para O(n²); se entrega el cálculo teórico.',
    };
  }

  const start = performance.now();
  let operations = 0;
  let duplicateCustomerPairsFound = 0;

  for (let i = 0; i < orders.length; i++) {
    for (let j = i + 1; j < orders.length; j++) {
      operations++;
      if (orders[i].customerName === orders[j].customerName) {
        duplicateCustomerPairsFound++;
      }
    }
  }

  const end = performance.now();
  const elapsedMs = Number((end - start).toFixed(4));

  return {
    size: requestedSize,
    algorithm: 'comparación de pares de pedidos',
    timeComplexity: 'O(n²)',
    operations,
    executed: true,
    elapsedMs,
    theoreticalFormula: 'n * (n - 1) / 2',
    duplicateCustomerPairsFound,
  };
}

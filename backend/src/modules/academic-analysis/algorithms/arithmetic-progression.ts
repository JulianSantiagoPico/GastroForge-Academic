export interface LoyaltyGoalResult {
  targetProducts: number;
  calculatedWeek: number;
  isExactWeek: boolean;
  formula: string;
  operations: number;
  timeComplexity: string;
}

export interface LoyaltyAnalysisResponse {
  customerLoyaltyRule: {
    initialProductsWeek1: number;
    weeklyIncrement: number;
    generalTermFormula: string;
    inverseWeekFormula: string;
  };
  targets: LoyaltyGoalResult[];
  timeComplexity: string;
  spaceComplexity: string;
}

/**
 * Resuelve la semana proyectada para alcanzar metas de fidelización en progresión aritmética.
 *
 * Fórmula de progresión aritmética:
 * a_n = a_1 + (n - 1) * d
 * Con a_1 = 2 (semana 1), d = 2 (incremento semanal).
 *
 * Despeje directo para la semana n:
 * n = ((objetivo - a_1) / d) + 1
 *
 * Complejidad: O(1) operaciones aritméticas por objetivo (no requiere bucles ni recursión).
 *
 * @param targets Lista de números enteros objetivos de productos.
 * @param a1 Productos iniciales en semana 1 (por defecto 2).
 * @param d Incremento semanal constante (por defecto 2).
 */
export function calculateLoyaltyProgression(
  targets: number[],
  a1 = 2,
  d = 2
): LoyaltyAnalysisResponse {
  const targetResults: LoyaltyGoalResult[] = targets.map((target) => {
    // Si el objetivo es menor a a1, se alcanza en la semana 1
    if (target <= a1) {
      return {
        targetProducts: target,
        calculatedWeek: 1,
        isExactWeek: target === a1,
        formula: `n = ((${target} - ${a1}) / ${d}) + 1`,
        operations: 1,
        timeComplexity: 'O(1)',
      };
    }

    const rawWeek = ((target - a1) / d) + 1;
    const week = Math.ceil(rawWeek);

    return {
      targetProducts: target,
      calculatedWeek: week,
      isExactWeek: Number.isInteger(rawWeek),
      formula: `n = ((${target} - ${a1}) / ${d}) + 1 = ${rawWeek}`,
      operations: 1,
      timeComplexity: 'O(1)',
    };
  });

  return {
    customerLoyaltyRule: {
      initialProductsWeek1: a1,
      weeklyIncrement: d,
      generalTermFormula: `a_n = ${a1} + (n - 1) * ${d}`,
      inverseWeekFormula: `n = ((target - ${a1}) / ${d}) + 1`,
    },
    targets: targetResults,
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
  };
}

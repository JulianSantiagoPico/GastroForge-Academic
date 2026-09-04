export interface DailySalesDataPoint {
  day: number;
  date: string;
  sales: number;
}

export interface SalesForecastPoint {
  daysAhead: number;
  projectedDay: number;
  projectedSales: number;
  formulaEvaluation: string;
}

export interface LinearRegressionResult {
  academicDisclaimer: string;
  historicalData: DailySalesDataPoint[];
  linearRegressionModel: {
    slope_m: number;
    intercept_b: number;
    equation: string;
    correlation_r2: number;
  };
  forecasts: SalesForecastPoint[];
  computationalComplexity: {
    timeComplexity: string;
    spaceComplexity: string;
    operationsCount: number;
  };
}

/**
 * Dataset histórico fijo y documentado de ventas diarias de restaurante (14 días).
 * Simula ventas en unidades monetarias (USD / COP miles).
 */
export const DEFAULT_HISTORICAL_SALES: DailySalesDataPoint[] = [
  { day: 1, date: '2026-08-18', sales: 120 },
  { day: 2, date: '2026-08-19', sales: 135 },
  { day: 3, date: '2026-08-20', sales: 128 },
  { day: 4, date: '2026-08-21', sales: 145 },
  { day: 5, date: '2026-08-22', sales: 180 },
  { day: 6, date: '2026-08-23', sales: 195 },
  { day: 7, date: '2026-08-24', sales: 150 },
  { day: 8, date: '2026-08-25', sales: 140 },
  { day: 9, date: '2026-08-26', sales: 155 },
  { day: 10, date: '2026-08-27', sales: 162 },
  { day: 11, date: '2026-08-28', sales: 175 },
  { day: 12, date: '2026-08-29', sales: 210 },
  { day: 13, date: '2026-08-30', sales: 225 },
  { day: 14, date: '2026-08-31', sales: 185 },
];

/**
 * Calcula la regresión lineal por mínimos cuadrados ordinarios (OLS): y = m * x + b.
 *
 * Fórmulas:
 * x̄ = Σ x_i / N, ȳ = Σ y_i / N
 * m = Σ ((x_i - x̄) * (y_i - ȳ)) / Σ (x_i - x̄)²
 * b = ȳ - m * x̄
 *
 * @param historical Conjunto de datos históricos (por defecto los 14 días simulados).
 * @param daysAhead Lista de días futuros a proyectar (por defecto [2, 5, 7]).
 */
export function calculateLinearRegressionForecast(
  historical: DailySalesDataPoint[] = DEFAULT_HISTORICAL_SALES,
  daysAhead: number[] = [2, 5, 7]
): LinearRegressionResult {
  const n = historical.length;
  let sumX = 0;
  let sumY = 0;
  let operations = 0;

  for (let i = 0; i < n; i++) {
    sumX += historical[i].day;
    sumY += historical[i].sales;
    operations += 2;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denominator = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const diffX = historical[i].day - meanX;
    const diffY = historical[i].sales - meanY;
    numerator += diffX * diffY;
    denominator += diffX * diffX;
    ssTot += diffY * diffY;
    operations += 5;
  }

  const m = denominator === 0 ? 0 : numerator / denominator;
  const b = meanY - m * meanX;

  // Cálculo de coeficiente de determinación R²
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const yPred = m * historical[i].day + b;
    const res = historical[i].sales - yPred;
    ssRes += res * res;
    operations += 3;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const lastDay = historical[historical.length - 1].day;

  const forecasts: SalesForecastPoint[] = daysAhead.map((offset) => {
    const projectedDay = lastDay + offset;
    const projectedSales = Number((m * projectedDay + b).toFixed(2));
    operations += 2;

    return {
      daysAhead: offset,
      projectedDay,
      projectedSales,
      formulaEvaluation: `y = (${m.toFixed(4)} * ${projectedDay}) + (${b.toFixed(4)}) = ${projectedSales}`,
    };
  });

  return {
    academicDisclaimer:
      'Estimación académica con fines de análisis de complejidad computacional y modelado matemático. No constituye una predicción financiera real.',
    historicalData: historical,
    linearRegressionModel: {
      slope_m: Number(m.toFixed(4)),
      intercept_b: Number(b.toFixed(4)),
      equation: `y = ${m.toFixed(4)}x + ${b.toFixed(4)}`,
      correlation_r2: Number(r2.toFixed(4)),
    },
    forecasts,
    computationalComplexity: {
      timeComplexity: 'O(N + K) donde N = datos históricos y K = proyecciones',
      spaceComplexity: 'O(1) auxiliar',
      operationsCount: operations,
    },
  };
}

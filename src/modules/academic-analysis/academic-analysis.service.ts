import { Injectable } from '@nestjs/common';
import { generateOrders } from './algorithms/order-generator';
import { findOrderById, LinearSearchResult } from './algorithms/linear-search';
import { countProcessedProducts, ProductAggregationResult } from './algorithms/aggregation';
import { countProductsRecursive, RecursiveAggregationResult } from './algorithms/recursive-analysis';
import { analyzeQuadraticPairs, QuadraticAnalysisResult } from './algorithms/quadratic-analysis';
import { calculateLoyaltyProgression, LoyaltyAnalysisResponse } from './algorithms/arithmetic-progression';
import {
  calculateLinearRegressionForecast,
  DEFAULT_HISTORICAL_SALES,
  LinearRegressionResult,
} from './algorithms/linear-regression';
import { BenchmarkQueryDto, SearchCase } from './dto/benchmark-query.dto';
import { QuadraticQueryDto } from './dto/quadratic-query.dto';
import { LoyaltyQueryDto } from './dto/loyalty-query.dto';
import { ForecastQueryDto } from './dto/forecast-query.dto';

export interface BenchmarkResponse {
  input: {
    size: number;
    case: string;
    dataSource: string;
  };
  linearSearch: LinearSearchResult;
  productAggregation: ProductAggregationResult;
  recursiveAggregation: RecursiveAggregationResult;
  notes: string[];
}

export interface ReportSizeRow {
  size: number;
  linearSearchOperations: number;
  productAggregationOperations: number;
  recursiveOperations: number;
  recursiveMaxDepth: number;
  quadraticOperations: number;
  quadraticExecuted: boolean;
  linearSearchElapsedMs: number;
  recursiveElapsedMs: number;
}

export interface FullAcademicReportResponse {
  title: string;
  course: string;
  purpose: string;
  methodologyNotes: string[];
  comparativeTable: ReportSizeRow[];
  quadraticSummationCase: {
    formula: string;
    explanation: string;
    safeLimit: number;
  };
  loyaltyProgressionCase: LoyaltyAnalysisResponse;
  salesForecastCase: LinearRegressionResult;
  theoreticalComplexitiesSummary: {
    linearSearch: { best: string; average: string; worst: string; space: string };
    productAggregation: { time: string; space: string };
    recursiveAggregation: { time: string; space: string; recursionDepth: string };
    quadraticPairComparison: { time: string; space: string; summation: string };
    arithmeticProgression: { time: string; space: string };
    linearRegression: { time: string; space: string };
  };
}

@Injectable()
export class AcademicAnalysisService {
  /**
   * Ejecuta el benchmark de algoritmos lineales y recursivo para un tamaño y caso específicos.
   */
  public runBenchmark(query: BenchmarkQueryDto): BenchmarkResponse {
    const size = query.size;
    const searchCase = query.case || SearchCase.WORST;

    const orders = generateOrders(size);

    let targetId: string;
    let targetPosition: number;

    switch (searchCase) {
      case SearchCase.BEST:
        targetPosition = 1;
        targetId = orders[0].id;
        break;
      case SearchCase.AVERAGE:
        targetPosition = Math.max(1, Math.floor(size / 2));
        targetId = orders[targetPosition - 1].id;
        break;
      case SearchCase.WORST:
      default:
        targetPosition = size;
        targetId = orders[size - 1].id;
        break;
    }

    const linearSearch = findOrderById(orders, targetId, targetPosition);
    const productAggregation = countProcessedProducts(orders);
    const recursiveAggregation = countProductsRecursive(orders);

    return {
      input: {
        size,
        case: searchCase,
        dataSource: 'Pedidos simulados deterministas con semilla fija 20260901',
      },
      linearSearch,
      productAggregation,
      recursiveAggregation,
      notes: [
        'elapsedMs puede variar según el hardware y el entorno de ejecución en Render.',
        'operations es la métrica canónica e invariante para comparar el orden de crecimiento Big O.',
      ],
    };
  }

  /**
   * Ejecuta o calcula analíticamente la comparación de pares de complejidad cuadrática O(n²).
   */
  public runQuadratic(query: QuadraticQueryDto): QuadraticAnalysisResult {
    const size = query.size;
    if (size <= 2000) {
      const orders = generateOrders(size);
      return analyzeQuadraticPairs(orders, size);
    }
    return analyzeQuadraticPairs([], size);
  }

  /**
   * Resuelve los objetivos de fidelización usando la progresión aritmética en O(1).
   */
  public runLoyalty(query: LoyaltyQueryDto): LoyaltyAnalysisResponse {
    return calculateLoyaltyProgression(query.targets);
  }

  /**
   * Modela la regresión lineal sobre datos históricos de ventas y genera pronósticos.
   */
  public runSalesForecast(query: ForecastQueryDto): LinearRegressionResult {
    return calculateLinearRegressionForecast(DEFAULT_HISTORICAL_SALES, query.daysAhead);
  }

  /**
   * Permite inspeccionar y visualizar una muestra de los pedidos generados en memoria.
   */
  public getOrdersSample(limit = 10, page = 1) {
    const offset = (page - 1) * limit;
    const totalToGenerate = Math.min(1000, offset + limit);
    const orders = generateOrders(totalToGenerate);
    const paginatedOrders = orders.slice(offset, offset + limit);

    return {
      page,
      limit,
      totalSampled: paginatedOrders.length,
      seedUsed: 20260901,
      orders: paginatedOrders,
    };
  }

  /**
   * Genera el reporte comparativo integral con los tamaños predefinidos en la guía académica:
   * [10, 100, 1000, 10000, 100000].
   */
  public generateFullReport(): FullAcademicReportResponse {
    const standardSizes = [10, 100, 1000, 10000, 100000];

    const comparativeTable: ReportSizeRow[] = standardSizes.map((size) => {
      const orders = generateOrders(size);
      const lastId = orders[size - 1].id;

      const linearRes = findOrderById(orders, lastId, size);
      const aggRes = countProcessedProducts(orders);
      const recRes = countProductsRecursive(orders);
      const quadRes = analyzeQuadraticPairs(size <= 2000 ? orders : [], size);

      return {
        size,
        linearSearchOperations: linearRes.operations,
        productAggregationOperations: aggRes.operations,
        recursiveOperations: recRes.operations,
        recursiveMaxDepth: recRes.maxDepth,
        quadraticOperations: quadRes.operations ?? quadRes.estimatedOperations ?? 0,
        quadraticExecuted: quadRes.executed,
        linearSearchElapsedMs: linearRes.elapsedMs,
        recursiveElapsedMs: recRes.elapsedMs,
      };
    });

    const loyaltyProgressionCase = calculateLoyaltyProgression([42, 72, 120]);
    const salesForecastCase = calculateLinearRegressionForecast(DEFAULT_HISTORICAL_SALES, [2, 5, 7]);

    return {
      title: 'Informe Comparativo de Complejidad Computacional - GastroForge Academic',
      course: 'Programación Avanzada',
      purpose:
        'Demostrar empírica y analíticamente el comportamiento de algoritmos fundamentales sobre colecciones de pedidos simulados.',
      methodologyNotes: [
        'Los datos se generan en memoria mediante un PRNG determinista con semilla fija 20260901, garantizando reproducibilidad absoluta.',
        'La métrica determinante es el conteo de operaciones elementales frente al aumento del tamaño n.',
        'Para el algoritmo cuadrático, se limita la ejecución física a n <= 2000 por salvaguarda de recursos en Render.',
        'La recursión divide y vencerás mantiene una profundidad log2(n), evitando desbordamiento de pila (call stack overflow).',
      ],
      comparativeTable,
      quadraticSummationCase: {
        formula: 'Sumatoria i=1 hasta n-1 de (n - i) = n(n - 1) / 2',
        explanation:
          'Comparar cada par único (i, j) con j > i produce una progresión decreciente de operaciones cuya sumatoria es de orden O(n²).',
        safeLimit: 2000,
      },
      loyaltyProgressionCase,
      salesForecastCase,
      theoreticalComplexitiesSummary: {
        linearSearch: {
          best: 'O(1)',
          average: 'O(n)',
          worst: 'O(n)',
          space: 'O(1)',
        },
        productAggregation: {
          time: 'O(n)',
          space: 'O(1)',
        },
        recursiveAggregation: {
          time: 'O(n)',
          space: 'O(log n)',
          recursionDepth: 'ceil(log2(n)) + 1',
        },
        quadraticPairComparison: {
          time: 'O(n²)',
          space: 'O(1)',
          summation: 'n(n - 1) / 2',
        },
        arithmeticProgression: {
          time: 'O(1)',
          space: 'O(1)',
        },
        linearRegression: {
          time: 'O(N)',
          space: 'O(1)',
        },
      },
    };
  }
}

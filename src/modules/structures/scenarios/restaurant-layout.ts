import { WeightedGraph } from '../data-structures/weighted-graph';

/**
 * Escenario predeterminado del plano de planta del restaurante GastroForge.
 *
 * Nodos estables:
 * - kitchen: Cocina central
 * - passage: Pasillo principal de distribución
 * - bar: Barra de bebidas
 * - table-1: Zona de mesas interior 1
 * - table-2: Zona de mesas interior 2
 * - terrace: Terraza exterior
 *
 * Calibración de ruta óptima:
 * kitchen -> passage (5s) -> table-1 (7s) -> terrace (9s) = 21 segundos en total.
 */
export function createDefaultRestaurantLayout(): WeightedGraph {
  const graph = new WeightedGraph();

  // Registrar nodos
  const nodes = ['kitchen', 'passage', 'bar', 'table-1', 'table-2', 'terrace'];
  for (const node of nodes) {
    graph.addNode(node);
  }

  // Conexiones de tránsito bidireccionales con costos en segundos
  graph.addEdge('kitchen', 'passage', 5, true);
  graph.addEdge('passage', 'table-1', 7, true);
  graph.addEdge('table-1', 'terrace', 9, true);

  graph.addEdge('kitchen', 'bar', 8, true);
  graph.addEdge('bar', 'passage', 4, true);
  graph.addEdge('passage', 'table-2', 6, true);
  graph.addEdge('table-2', 'terrace', 12, true);
  graph.addEdge('bar', 'terrace', 18, true);

  return graph;
}

export const DEFAULT_RESTAURANT_NODES = [
  'kitchen',
  'passage',
  'bar',
  'table-1',
  'table-2',
  'terrace',
];

import { MinHeap } from './min-heap';

export interface Edge {
  to: string;
  cost: number;
}

export type AdjacencyList = Map<string, Edge[]>;

export interface DijkstraResult {
  reachable: boolean;
  path: string[];
  totalCost: number | null;
  visitedNodesCount: number;
  operationsCount: number;
  distances: Record<string, number | null>;
}

interface HeapNode {
  node: string;
  cost: number;
}

/**
 * Grafo ponderado dirigido/no dirigido representado mediante Lista de Adyacencia (Map<string, Edge[]>).
 *
 * Justificación académica:
 * Modela la distribución física y rutas internas del restaurante.
 * Implementa el algoritmo de Dijkstra usando el MinHeap propio para extraer el nodo con menor costo acumulado
 * en O(log V), resultando en una complejidad O((V + E) log V).
 */
export class WeightedGraph {
  private adjacencyList: AdjacencyList = new Map();

  /**
   * Agrega un nodo al grafo si no existe previamente.
   */
  addNode(node: string): void {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, []);
    }
  }

  /**
   * Agrega una arista ponderada. Valida que el costo no sea negativo.
   */
  addEdge(from: string, to: string, cost: number, bidirectional = false): void {
    if (cost < 0) {
      throw new Error(`El peso de la arista (${from} -> ${to}: ${cost}) no puede ser negativo.`);
    }

    this.addNode(from);
    this.addNode(to);

    this.adjacencyList.get(from)!.push({ to, cost });

    if (bidirectional) {
      this.adjacencyList.get(to)!.push({ to: from, cost });
    }
  }

  /**
   * Retorna los nodos registrados en el grafo.
   */
  getNodes(): string[] {
    return Array.from(this.adjacencyList.keys());
  }

  /**
   * Retorna las aristas salientes de un nodo dado.
   */
  getEdges(from: string): Edge[] {
    return this.adjacencyList.get(from) || [];
  }

  /**
   * Verifica si un nodo existe en el grafo.
   */
  hasNode(node: string): boolean {
    return this.adjacencyList.has(node);
  }

  /**
   * Algoritmo de Dijkstra para encontrar el camino más corto entre startNode y targetNode.
   * Utiliza el MinHeap propio y Map para distancias y predecesores.
   */
  dijkstra(startNode: string, targetNode: string): DijkstraResult {
    // Si alguno de los nodos no existe en el grafo, no es alcanzable
    if (!this.hasNode(startNode) || !this.hasNode(targetNode)) {
      return {
        reachable: false,
        path: [],
        totalCost: null,
        visitedNodesCount: 0,
        operationsCount: 1,
        distances: {},
      };
    }

    const distances = new Map<string, number>();
    const predecessors = new Map<string, string | null>();
    const visited = new Set<string>();

    // Inicializar distancias a infinito
    for (const node of this.getNodes()) {
      distances.set(node, Infinity);
      predecessors.set(node, null);
    }
    distances.set(startNode, 0);

    // MinHeap ordenado por costo acumulado menor primero
    const minHeap = new MinHeap<HeapNode>((a, b) => a.cost - b.cost);
    minHeap.insert({ node: startNode, cost: 0 });

    let operationsCount = 0;

    while (!minHeap.isEmpty()) {
      operationsCount++;
      const current = minHeap.extractMin()!;
      const currentNode = current.node;
      const currentCost = current.cost;

      // Descartar entradas obsoletas del heap cuyo costo sea mayor que la distancia mínima ya registrada
      if (currentCost > (distances.get(currentNode) ?? Infinity)) {
        continue;
      }

      visited.add(currentNode);

      // Si llegamos al destino, podemos detener la búsqueda
      if (currentNode === targetNode) {
        break;
      }

      const neighbors = this.getEdges(currentNode);
      for (const edge of neighbors) {
        operationsCount++;
        const neighbor = edge.to;
        const newDistance = currentCost + edge.cost;

        if (newDistance < (distances.get(neighbor) ?? Infinity)) {
          distances.set(neighbor, newDistance);
          predecessors.set(neighbor, currentNode);
          minHeap.insert({ node: neighbor, cost: newDistance });
        }
      }
    }

    const targetDistance = distances.get(targetNode);
    const reachable = targetDistance !== undefined && targetDistance !== Infinity;

    // Reconstruir el camino desde targetNode hacia startNode
    const path: string[] = [];
    if (reachable) {
      let step: string | null = targetNode;
      while (step !== null) {
        path.unshift(step);
        step = predecessors.get(step) ?? null;
      }
    }

    // Convertir distancias a objeto serializable
    const distancesObj: Record<string, number | null> = {};
    for (const [node, dist] of distances.entries()) {
      distancesObj[node] = dist === Infinity ? null : dist;
    }

    return {
      reachable,
      path,
      totalCost: reachable ? targetDistance : null,
      visitedNodesCount: visited.size,
      operationsCount,
      distances: distancesObj,
    };
  }
}

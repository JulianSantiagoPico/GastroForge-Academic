import { BadRequestException, Injectable } from '@nestjs/common';
import { Queue } from './data-structures/queue';
import { MinHeap } from './data-structures/min-heap';
import { Stack } from './data-structures/stack';
import { WeightedGraph } from './data-structures/weighted-graph';
import { createDefaultRestaurantLayout } from './scenarios/restaurant-layout';
import {
  DraftAction,
  DraftItem,
  DraftSimulationResult,
  IndexOrder,
  IndexQueryResult,
  IndexSimulationResult,
  PrioritySimulationResult,
  PriorityTask,
  QueueOrderItem,
  QueueSimulationResult,
  RouteResult,
  StructuresComparisonResponse,
  UrgencyLevel,
} from './interfaces/structures.interface';
import { QueueSimulationDto } from './dto/queue-simulation.dto';
import { PrioritySimulationDto } from './dto/priority-simulation.dto';
import { DraftSimulationDto } from './dto/draft-simulation.dto';
import { DefaultRouteQueryDto, ShortestPathDto } from './dto/shortest-path.dto';
import { OrderIndexDto } from './dto/order-index.dto';

@Injectable()
export class StructuresService {
  /**
   * 1. Cola FIFO: Simula la recepción y despacho de comandas en cocina por orden estricto de llegada.
   */
  simulateQueue(dto: QueueSimulationDto): QueueSimulationResult {
    const queue = new Queue<QueueOrderItem>();

    // Encolar pedidos en orden de llegada (O(1) por inserción)
    for (const order of dto.orders) {
      queue.enqueue({
        id: order.id,
        table: order.table,
        items: order.items,
        clientName: order.clientName,
        createdAt: new Date().toISOString(),
      });
    }

    const enqueuedOrders = queue.toArray();
    const dequeuedOrderSequence: QueueOrderItem[] = [];

    // Desencolar pedidos secuencialmente (O(1) por extracción)
    while (!queue.isEmpty()) {
      const order = queue.dequeue();
      if (order) {
        dequeuedOrderSequence.push(order);
      }
    }

    return {
      receivedOrdersCount: dto.orders.length,
      enqueuedOrders,
      dequeuedOrderSequence,
      complexity: {
        enqueue: 'O(1) con lista enlazada (sin reindexación)',
        dequeue: 'O(1) al mover puntero de cabeza (head = head.next)',
        peek: 'O(1) inspección directa del nodo cabeza',
      },
      explanation:
        'La cola FIFO garantiza equidad y atención estricta por orden de llegada. La implementación basada en lista enlazada asegura O(1) real en enqueue y dequeue, superando la ineficiencia O(n) de Array.shift() provocada por la reindexación continua en memoria.',
    };
  }

  /**
   * 2. Heap / Cola de Prioridad: Despacha comandas según urgencia calculada (effectivePriority).
   */
  simulatePriority(dto: PrioritySimulationDto): PrioritySimulationResult {
    const urgencyMap: Record<UrgencyLevel, number> = {
      urgente: 100,
      normal: 50,
      baja: 10,
    };

    // Calcular prioridad efectiva: effectivePriority = basePriority + waitingMinutes
    const calculatedTasks: PriorityTask[] = dto.tasks.map((task) => {
      const basePriority = urgencyMap[task.urgency] ?? 50;
      const effectivePriority = basePriority + task.waitingMinutes;
      return {
        id: task.id,
        description: task.description,
        urgency: task.urgency,
        waitingMinutes: task.waitingMinutes,
        basePriority,
        effectivePriority,
      };
    });

    // MinHeap configurado para despachar mayor prioridad efectiva primero (b.effective - a.effective)
    const heap = new MinHeap<PriorityTask>(
      (a, b) => b.effectivePriority - a.effectivePriority
    );

    // Inserción en el montículo: O(log n) por tarea
    for (const task of calculatedTasks) {
      heap.insert(task);
    }

    // Extracción sucesiva de la raíz óptima: O(log n) por tarea
    const dispatchedSequence: PriorityTask[] = [];
    while (!heap.isEmpty()) {
      const nextTask = heap.extractMin();
      if (nextTask) {
        dispatchedSequence.push(nextTask);
      }
    }

    return {
      totalTasks: dto.tasks.length,
      tasksCalculated: calculatedTasks,
      dispatchedSequence,
      complexity: {
        insert: 'O(log n) reubicación ascendente (bubbleUp)',
        extractMin: 'O(log n) rebalanceo descendente (bubbleDown)',
        peek: 'O(1) acceso inmediato a la raíz óptima',
      },
      rule: 'effectivePriority = basePriority + waitingMinutes (urgente: 100, normal: 50, baja: 10)',
      explanation:
        'El montículo binario mantiene en su raíz la tarea más urgente sin ordenar la colección completa. A diferencia de un ordenamiento O(n log n) tras cada inserción, el heap ofrece inserción y extracción garantizadas en O(log n), ideal para entornos dinámicos de cocina.',
    };
  }

  /**
   * 3. Pila: Historial reversible de borrador de comanda (Undo / Redo).
   */
  simulateDraft(dto: DraftSimulationDto): DraftSimulationResult {
    const itemsMap = new Map<string, DraftItem>();
    const undoStack = new Stack<DraftAction>();
    const redoStack = new Stack<DraftAction>();
    const stepHistory: string[] = [];

    for (const action of dto.actions) {
      const itemId = action.itemId ?? 'ITEM-DEF';
      const itemName = action.name ?? 'Producto';

      switch (action.type) {
        case 'ADD_ITEM': {
          const qty = action.quantity ?? 1;
          const price = action.price ?? 10000;
          const existing = itemsMap.get(itemId);

          if (existing) {
            const prevQty = existing.quantity;
            existing.quantity += qty;
            undoStack.push({
              type: 'UPDATE_QUANTITY',
              itemId,
              quantity: prevQty,
              previousQuantity: existing.quantity,
            });
            stepHistory.push(
              `ADD_ITEM acumulado: ${itemName} (${itemId}) cantidad previa ${prevQty} -> nueva ${existing.quantity}`
            );
          } else {
            itemsMap.set(itemId, { itemId, name: itemName, quantity: qty, price });
            undoStack.push({
              type: 'REMOVE_ITEM',
              itemId,
              name: itemName,
              quantity: qty,
              price,
            });
            stepHistory.push(`ADD_ITEM: Agregado ${itemName} (${itemId}) x${qty}`);
          }
          // Regla didáctica: nueva acción posterior a undo invalida el redoStack
          redoStack.clear();
          break;
        }

        case 'UPDATE_QUANTITY': {
          const newQty = action.quantity ?? 1;
          const existing = itemsMap.get(itemId);
          const prevQty = existing ? existing.quantity : 0;

          if (existing) {
            existing.quantity = newQty;
            undoStack.push({
              type: 'UPDATE_QUANTITY',
              itemId,
              quantity: prevQty,
              previousQuantity: newQty,
            });
            stepHistory.push(
              `UPDATE_QUANTITY: ${itemId} cantidad actualizada de ${prevQty} a ${newQty}`
            );
          } else {
            itemsMap.set(itemId, {
              itemId,
              name: itemName,
              quantity: newQty,
              price: action.price ?? 10000,
            });
            undoStack.push({
              type: 'REMOVE_ITEM',
              itemId,
              name: itemName,
              quantity: newQty,
            });
            stepHistory.push(
              `UPDATE_QUANTITY: ${itemId} no existía, creado con cantidad ${newQty}`
            );
          }
          redoStack.clear();
          break;
        }

        case 'REMOVE_ITEM': {
          const existing = itemsMap.get(itemId);
          if (existing) {
            itemsMap.delete(itemId);
            undoStack.push({
              type: 'ADD_ITEM',
              itemId,
              name: existing.name,
              quantity: existing.quantity,
              price: existing.price,
            });
            stepHistory.push(`REMOVE_ITEM: Eliminado ${existing.name} (${itemId})`);
          } else {
            stepHistory.push(`REMOVE_ITEM ignorado: ${itemId} no existe en el borrador`);
          }
          redoStack.clear();
          break;
        }

        case 'UNDO': {
          if (undoStack.isEmpty()) {
            stepHistory.push('UNDO ignorado: Pila de deshacer vacía');
            break;
          }
          const reverseAction = undoStack.pop()!;
          const targetId = reverseAction.itemId ?? itemId;

          if (reverseAction.type === 'REMOVE_ITEM') {
            const currentItem = itemsMap.get(targetId);
            itemsMap.delete(targetId);
            redoStack.push({
              type: 'ADD_ITEM',
              itemId: targetId,
              name: currentItem?.name ?? itemName,
              quantity: currentItem?.quantity ?? 1,
              price: currentItem?.price,
            });
            stepHistory.push(`UNDO: Revertido agregado de ${targetId} (eliminado)`);
          } else if (reverseAction.type === 'ADD_ITEM') {
            itemsMap.set(targetId, {
              itemId: targetId,
              name: reverseAction.name ?? itemName,
              quantity: reverseAction.quantity ?? 1,
              price: reverseAction.price,
            });
            redoStack.push({
              type: 'REMOVE_ITEM',
              itemId: targetId,
            });
            stepHistory.push(
              `UNDO: Restaurado ítem eliminado ${reverseAction.name} (${targetId}) x${reverseAction.quantity}`
            );
          } else if (reverseAction.type === 'UPDATE_QUANTITY') {
            const currentItem = itemsMap.get(targetId);
            const currentQty = currentItem ? currentItem.quantity : 0;
            if (currentItem) {
              currentItem.quantity = reverseAction.quantity ?? 1;
            }
            redoStack.push({
              type: 'UPDATE_QUANTITY',
              itemId: targetId,
              quantity: currentQty,
            });
            stepHistory.push(
              `UNDO: Revertida cantidad de ${targetId} a ${reverseAction.quantity}`
            );
          }
          break;
        }

        case 'REDO': {
          if (redoStack.isEmpty()) {
            stepHistory.push('REDO ignorado: Pila de rehacer vacía');
            break;
          }
          const forwardAction = redoStack.pop()!;
          const targetId = forwardAction.itemId ?? itemId;

          if (forwardAction.type === 'ADD_ITEM') {
            itemsMap.set(targetId, {
              itemId: targetId,
              name: forwardAction.name ?? itemName,
              quantity: forwardAction.quantity ?? 1,
              price: forwardAction.price,
            });
            undoStack.push({
              type: 'REMOVE_ITEM',
              itemId: targetId,
            });
            stepHistory.push(
              `REDO: Re-agregado ítem ${forwardAction.name} (${targetId}) x${forwardAction.quantity}`
            );
          } else if (forwardAction.type === 'REMOVE_ITEM') {
            const current = itemsMap.get(targetId);
            itemsMap.delete(targetId);
            undoStack.push({
              type: 'ADD_ITEM',
              itemId: targetId,
              name: current?.name ?? itemName,
              quantity: current?.quantity ?? 1,
              price: current?.price,
            });
            stepHistory.push(`REDO: Re-eliminado ítem ${targetId}`);
          } else if (forwardAction.type === 'UPDATE_QUANTITY') {
            const current = itemsMap.get(targetId);
            const prevQty = current ? current.quantity : 0;
            if (current) {
              current.quantity = forwardAction.quantity ?? 1;
            }
            undoStack.push({
              type: 'UPDATE_QUANTITY',
              itemId: targetId,
              quantity: prevQty,
            });
            stepHistory.push(
              `REDO: Re-aplicada cantidad ${forwardAction.quantity} sobre ${targetId}`
            );
          }
          break;
        }
      }
    }

    const finalItems = Array.from(itemsMap.values());

    return {
      finalItems,
      totalItemsCount: finalItems.length,
      undoStackSize: undoStack.size(),
      redoStackSize: redoStack.size(),
      stepHistory,
      complexity: {
        push: 'O(1) almacenamiento en el tope de la pila',
        pop: 'O(1) recuperación y desapilado inmediato',
        peek: 'O(1) consulta del estado superior',
      },
      explanation:
        'El historial de borrador utiliza dos pilas LIFO (Undo y Redo). Cada acción reversible se apila en O(1). Al ejecutar Undo se extrae la última acción, se aplica su inversa determinista y se transfiere a Redo. Cualquier acción nueva post-undo purga la pila de rehacer.',
    };
  }

  /**
   * 4. Grafo y Dijkstra: Ruta óptima en el plano predeterminado del restaurante.
   */
  getDefaultRoute(query: DefaultRouteQueryDto): RouteResult {
    const from = query.from || 'kitchen';
    const to = query.to || 'terrace';

    const graph = createDefaultRestaurantLayout();
    const result = graph.dijkstra(from, to);

    return {
      from,
      to,
      reachable: result.reachable,
      path: result.path,
      totalCostSeconds: result.totalCost,
      visitedNodesCount: result.visitedNodesCount,
      operationsCount: result.operationsCount,
      distances: result.distances,
      complexity: {
        dijkstra: 'O((V + E) log V) empleando MinHeap para la selección del nodo más cercano',
        storage: 'O(V + E) lista de adyacencia Map<string, Edge[]>',
      },
      explanation: result.reachable
        ? `Ruta mínima encontrada de ${from} a ${to} con costo total de ${result.totalCost} segundos a través de los nodos: [${result.path.join(
            ' -> '
          )}].`
        : `El nodo destino ${to} no es alcanzable desde el origen ${from}.`,
    };
  }

  /**
   * 5. Grafo y Dijkstra: Camino más corto sobre un grafo dinámico enviado por el cliente.
   */
  getShortestPath(dto: ShortestPathDto): RouteResult {
    const graph = new WeightedGraph();

    for (const node of dto.nodes) {
      graph.addNode(node);
    }

    for (const edge of dto.edges) {
      try {
        graph.addEdge(edge.from, edge.to, edge.cost, dto.bidirectional);
      } catch (err: any) {
        throw new BadRequestException(err.message || 'Error al procesar arista del grafo');
      }
    }

    const result = graph.dijkstra(dto.startNode, dto.targetNode);

    return {
      from: dto.startNode,
      to: dto.targetNode,
      reachable: result.reachable,
      path: result.path,
      totalCostSeconds: result.totalCost,
      visitedNodesCount: result.visitedNodesCount,
      operationsCount: result.operationsCount,
      distances: result.distances,
      complexity: {
        dijkstra: 'O((V + E) log V) con MinHeap propio',
        storage: 'O(V + E) lista de adyacencia',
      },
      explanation: result.reachable
        ? `Ruta mínima encontrada con costo de ${result.totalCost} unidades de costo.`
        : `No existe camino posible entre ${dto.startNode} y ${dto.targetNode} en el grafo proporcionado.`,
    };
  }

  /**
   * 6. Map vs Búsqueda Lineal: Demostración de acceso directo O(1) vs búsqueda secuencial O(n).
   */
  simulateIndex(dto: OrderIndexDto): IndexSimulationResult {
    // Generar o utilizar pedidos para indexar
    const orders: IndexOrder[] =
      dto.orders && dto.orders.length > 0
        ? dto.orders.map((o) => ({
            id: o.id,
            table: o.table,
            total: o.total,
            clientName: o.clientName,
          }))
        : Array.from({ length: 50 }, (_, i) => {
            const id = `ORD-${String(i + 1).padStart(3, '0')}`;
            return {
              id,
              table: (i % 10) + 1,
              total: 25000 + i * 1500,
              clientName: `Cliente ${i + 1}`,
            };
          });

    // Construcción del índice Map en memoria
    const orderMap = new Map<string, IndexOrder>();
    for (const order of orders) {
      orderMap.set(order.id, order);
    }

    const queries: IndexQueryResult[] = [];
    let totalMapOps = 0;
    let totalLinearOps = 0;

    for (const searchId of dto.searchIds) {
      // Acceso en Map: O(1) promedio mediante tabla hash
      const mapOps = 1;
      totalMapOps += mapOps;
      const foundInMap = orderMap.has(searchId);
      const foundOrder = orderMap.get(searchId) || null;

      // Búsqueda lineal: O(n) recorriendo elementos uno a uno
      let linearOps = 0;
      let linearMatch: IndexOrder | null = null;
      for (let i = 0; i < orders.length; i++) {
        linearOps++;
        if (orders[i].id === searchId) {
          linearMatch = orders[i];
          break;
        }
      }
      totalLinearOps += linearOps;

      queries.push({
        searchId,
        found: foundInMap,
        order: foundOrder,
        mapOperations: mapOps,
        linearOperations: linearOps,
      });
    }

    const queryCount = dto.searchIds.length || 1;

    return {
      totalOrdersIndexed: orders.length,
      queries,
      mapAverageOperations: +(totalMapOps / queryCount).toFixed(2),
      linearAverageOperations: +(totalLinearOps / queryCount).toFixed(2),
      complexity: {
        mapAccess: 'O(1) promedio mediante indexación por clave hash',
        linearAccess: 'O(n) en el peor/promedio de los casos recorriendo la lista secuencial',
      },
      explanation:
        'El Map temporal permite acceso directo a pedidos por clave única con O(1) operaciones constantes independientemente del volumen, mientras que la búsqueda lineal requiere recorrer en promedio n/2 comparaciones y hasta n en el peor caso.',
    };
  }

  /**
   * 7. Resumen comparativo de estructuras de datos académicas.
   */
  getStructuresComparison(): StructuresComparisonResponse {
    return {
      title: 'Matriz Comparativa de Estructuras de Datos - GastroForge Academic',
      module: 'Data-Structures (Unidad 2)',
      structures: [
        {
          structure: 'Cola FIFO (Linked List)',
          academicUseCase: 'Toma y despacho de comandas de cocina en orden de llegada equitativo.',
          keyOperations: {
            enqueue: 'O(1)',
            dequeue: 'O(1)',
            peek: 'O(1)',
          },
          timeComplexity: 'O(1) para operaciones en extremos',
          spaceComplexity: 'O(n) almacenamiento de nodos enlazados',
          tradeOffs:
            'Garantiza O(1) estricto sin reindexación; acceso secuencial sin capacidad de búsqueda aleatoria directa.',
        },
        {
          structure: 'Montículo Binario (MinHeap)',
          academicUseCase:
            'Selección repetida de la siguiente tarea culinaria por urgencia calculada.',
          keyOperations: {
            insert: 'O(log n)',
            extractMin: 'O(log n)',
            peek: 'O(1)',
          },
          timeComplexity: 'O(log n) inserción y extracción; O(1) consulta de raíz',
          spaceComplexity: 'O(n) arreglo contiguo balanceado',
          tradeOffs:
            'Óptimo para prioridades dinámicas continuas; no mantiene el resto de elementos completamente ordenados.',
        },
        {
          structure: 'Pila LIFO (Stack)',
          academicUseCase:
            'Historial de cambios de borrador de comanda con capacidad de Undo y Redo.',
          keyOperations: {
            push: 'O(1)',
            pop: 'O(1)',
            peek: 'O(1)',
          },
          timeComplexity: 'O(1) en el tope',
          spaceComplexity: 'O(k) donde k es el número de pasos reversibles',
          tradeOffs:
            'Simple e instantánea para retroceder estados; no permite mutar pasos intermedios sin desapilar.',
        },
        {
          structure: 'Grafo Ponderado + Dijkstra',
          academicUseCase:
            'Ruta óptima de tránsito de camareros entre cocina, pasillo, barra, mesas y terraza.',
          keyOperations: {
            addNode: 'O(1)',
            addEdge: 'O(1)',
            dijkstra: 'O((V + E) log V)',
          },
          timeComplexity: 'O((V + E) log V) con MinHeap',
          spaceComplexity: 'O(V + E) lista de adyacencia',
          tradeOffs:
            'Encuentra rutas mínimas con pesos variables no negativos; requiere pesos no negativos (si fuesen constantes convendría BFS).',
        },
        {
          structure: 'Tabla Hash (Map)',
          academicUseCase:
            'Índice temporal en memoria para acceso inmediato a pedidos por identificador.',
          keyOperations: {
            set: 'O(1) promedio',
            get: 'O(1) promedio',
            has: 'O(1) promedio',
          },
          timeComplexity: 'O(1) promedio, O(n) peor caso ante colisiones masivas',
          spaceComplexity: 'O(n) espacio proporcional al número de pares clave-valor',
          tradeOffs:
            'Acceso inmediato O(1) por clave; carece de orden intrínseco de llegada o prioridad.',
        },
      ],
    };
  }
}

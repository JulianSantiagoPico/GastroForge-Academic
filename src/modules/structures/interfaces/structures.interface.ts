export type UrgencyLevel = 'urgente' | 'normal' | 'baja';

export interface QueueOrderItem {
  id: string;
  table: number;
  items: string[];
  clientName?: string;
  createdAt?: string;
}

export interface QueueSimulationResult {
  receivedOrdersCount: number;
  enqueuedOrders: QueueOrderItem[];
  dequeuedOrderSequence: QueueOrderItem[];
  complexity: {
    enqueue: string;
    dequeue: string;
    peek: string;
  };
  explanation: string;
}

export interface PriorityTask {
  id: string;
  description: string;
  urgency: UrgencyLevel;
  waitingMinutes: number;
  basePriority: number;
  effectivePriority: number;
}

export interface PrioritySimulationResult {
  totalTasks: number;
  tasksCalculated: PriorityTask[];
  dispatchedSequence: PriorityTask[];
  complexity: {
    insert: string;
    extractMin: string;
    peek: string;
  };
  rule: string;
  explanation: string;
}

export type DraftActionType =
  | 'ADD_ITEM'
  | 'UPDATE_QUANTITY'
  | 'REMOVE_ITEM'
  | 'UNDO'
  | 'REDO';

export interface DraftItem {
  itemId: string;
  name: string;
  quantity: number;
  price?: number;
}

export interface DraftAction {
  type: DraftActionType;
  itemId?: string;
  name?: string;
  quantity?: number;
  previousQuantity?: number;
  price?: number;
}

export interface DraftSimulationResult {
  finalItems: DraftItem[];
  totalItemsCount: number;
  undoStackSize: number;
  redoStackSize: number;
  stepHistory: string[];
  complexity: {
    push: string;
    pop: string;
    peek: string;
  };
  explanation: string;
}

export interface RouteResult {
  from: string;
  to: string;
  reachable: boolean;
  path: string[];
  totalCostSeconds: number | null;
  visitedNodesCount: number;
  operationsCount: number;
  distances: Record<string, number | null>;
  complexity: {
    dijkstra: string;
    storage: string;
  };
  explanation: string;
}

export interface IndexOrder {
  id: string;
  table: number;
  total: number;
  clientName?: string;
}

export interface IndexQueryResult {
  searchId: string;
  found: boolean;
  order: IndexOrder | null;
  mapOperations: number;
  linearOperations: number;
}

export interface IndexSimulationResult {
  totalOrdersIndexed: number;
  queries: IndexQueryResult[];
  mapAverageOperations: number;
  linearAverageOperations: number;
  complexity: {
    mapAccess: string;
    linearAccess: string;
  };
  explanation: string;
}

export interface StructureComparisonItem {
  structure: string;
  academicUseCase: string;
  keyOperations: Record<string, string>;
  timeComplexity: string;
  spaceComplexity: string;
  tradeOffs: string;
}

export interface StructuresComparisonResponse {
  title: string;
  module: string;
  structures: StructureComparisonItem[];
}

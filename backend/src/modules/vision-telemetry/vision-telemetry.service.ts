import { Injectable, NotFoundException } from '@nestjs/common';
import { MinHeap } from '../structures/data-structures/min-heap';
import { createDefaultRestaurantLayout, DEFAULT_RESTAURANT_NODES } from '../structures/scenarios/restaurant-layout';
import { IngestTelemetryDto, TableTelemetryDto } from './dto/ingest-telemetry.dto';
import {
  DispatchPriorityItem,
  SalonStatusResponse,
} from './interfaces/vision-telemetry.interface';

@Injectable()
export class VisionTelemetryService {
  private latestSnapshot: IngestTelemetryDto | null = null;
  private tablesMap: Map<string, TableTelemetryDto> = new Map();
  private alertsLog: string[] = [];

  /**
   * Ingesta y valida un paquete de telemetría proveniente del motor de visión por computadora.
   */
  ingest(dto: IngestTelemetryDto): {
    success: boolean;
    ingestedTables: number;
    timestamp: string;
    system: string;
    alertsTriggered: string[];
  } {
    this.latestSnapshot = dto;
    this.tablesMap.clear();

    const newlyTriggeredAlerts: string[] = [];

    // Actualizar registro en memoria de mesas
    for (const table of dto.tables) {
      this.tablesMap.set(table.table_id, table);

      if (table.has_hygiene_incident) {
        const msg = `[ALERTA HIGIENE] ${table.table_id}: Comensales sentados sobre mesa sin desinfectar.`;
        newlyTriggeredAlerts.push(msg);
      }
      if (table.state === 'por_recoger') {
        const msg = `[ALERTA ROTACIÓN] ${table.table_id}: Mesa desocupada pendiente de recolección de vajilla.`;
        newlyTriggeredAlerts.push(msg);
      }
    }

    if (dto.kpis.service_bottleneck_detected) {
      newlyTriggeredAlerts.push(
        '[CUELLO DE BOTELLA] Demora operativa: Existen mesas libres pero alta cola de espera.'
      );
    }

    if (dto.kpis.low_demand_detected) {
      newlyTriggeredAlerts.push(
        '[BAJA DEMANDA] Capacidad ociosa: Baja ocupación sin comensales en espera.'
      );
    }

    this.alertsLog = newlyTriggeredAlerts;

    return {
      success: true,
      ingestedTables: dto.tables.length,
      timestamp: dto.timestamp,
      system: dto.system,
      alertsTriggered: newlyTriggeredAlerts,
    };
  }

  /**
   * Obtiene el estado consolidado actual del salón gastronómico.
   */
  getSalonStatus(): SalonStatusResponse {
    if (!this.latestSnapshot) {
      return {
        system: 'GastroForge-Vision-Ultralytics',
        lastSyncTimestamp: new Date().toISOString(),
        currentTimeSeconds: 0,
        salonSummary: {
          total_tables: 0,
          free_tables: 0,
          occupied_tables: 0,
          pending_clean_tables: 0,
          cleaning_tables: 0,
          temporary_absence_tables: 0,
          occupancy_rate_percent: 0,
        },
        kpis: {
          avg_first_service_latency_seconds: null,
          avg_turnover_latency_seconds: null,
          avg_stay_duration_seconds: null,
          hygiene_incidents_count: 0,
          waiting_queue_count: 0,
          service_bottleneck_detected: false,
          low_demand_detected: false,
          operational_diagnosis: 'SIN_TELEMETRIA_ACTIVA',
        },
        tables: [],
        activeAlerts: ['Esperando primera conexión de telemetría desde el motor de visión.'],
      };
    }

    return {
      system: this.latestSnapshot.system,
      lastSyncTimestamp: this.latestSnapshot.timestamp,
      currentTimeSeconds: this.latestSnapshot.current_time_seconds,
      salonSummary: this.latestSnapshot.salon_summary,
      kpis: this.latestSnapshot.kpis,
      tables: Array.from(this.tablesMap.values()),
      activeAlerts: this.alertsLog,
    };
  }

  /**
   * Lista todas las mesas con su estado de telemetría.
   */
  getTables(): TableTelemetryDto[] {
    return Array.from(this.tablesMap.values());
  }

  /**
   * Obtiene el estado de una mesa por su identificador.
   */
  getTableById(tableId: string): TableTelemetryDto {
    const table = this.tablesMap.get(tableId);
    if (!table) {
      throw new NotFoundException(`Mesa con ID '${tableId}' no encontrada en la telemetría actual.`);
    }
    return table;
  }

  /**
   * Mapea un identificador arbitrario de mesa al nodo más cercano en el grafo del restaurante.
   */
  private mapTableToGraphNode(tableId: string): string {
    const normalized = tableId.toLowerCase().replace(/\s+/g, '-');
    if (DEFAULT_RESTAURANT_NODES.includes(normalized)) {
      return normalized;
    }
    if (normalized.includes('1') || normalized.includes('mesa-1')) {
      return 'table-1';
    }
    if (normalized.includes('2') || normalized.includes('mesa-2')) {
      return 'table-2';
    }
    if (normalized.includes('terraza') || normalized.includes('terrace') || normalized.includes('3')) {
      return 'terrace';
    }
    // Distribución por defecto a zonas de salón
    return 'table-1';
  }

  /**
   * Calcula la ruta óptima de despacho (Dijkstra) desde la cocina hasta la mesa requerida.
   */
  getDispatchRoute(tableId: string): {
    tableId: string;
    mappedNode: string;
    from: string;
    path: string[];
    transitSeconds: number | null;
    reachable: boolean;
  } {
    const targetNode = this.mapTableToGraphNode(tableId);
    const graph = createDefaultRestaurantLayout();
    const dijkstraResult = graph.dijkstra('kitchen', targetNode);

    return {
      tableId,
      mappedNode: targetNode,
      from: 'kitchen',
      path: dijkstraResult.path,
      transitSeconds: dijkstraResult.totalCost,
      reachable: dijkstraResult.reachable,
    };
  }

  /**
   * Construye una cola de prioridad (MinHeap) que jerarquiza las mesas que requieren
   * intervención física inmediata del personal de servicio o cocina.
   */
  getServicePriorityQueue(): {
    totalPendingTasks: number;
    prioritizedTasks: DispatchPriorityItem[];
    algorithm: string;
  } {
    const heap = new MinHeap<DispatchPriorityItem>(
      (a, b) => b.priorityScore - a.priorityScore // Mayor score de urgencia despacha primero
    );

    for (const table of this.tablesMap.values()) {
      let score = 10;
      let urgency: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
      let reason = 'Mesa en flujo operativo normal';

      if (table.has_hygiene_incident) {
        urgency = 'CRITICA';
        score = 100 + Math.round(table.occupied_duration_seconds);
        reason = 'Incidente de higiene: comensales sentados sobre platos sucios de la sesión previa.';
      } else if (table.state === 'por_recoger') {
        urgency = 'ALTA';
        score = 80;
        reason = 'Vajilla sucia pendiente de desbarase para liberar mesa para rotación.';
      } else if (table.state === 'ocupada' && !table.first_dish_served) {
        urgency = 'MEDIA';
        score = 50 + Math.min(30, Math.round(table.occupied_duration_seconds));
        reason = 'Comensales a la espera de entrega del primer plato (TPA).';
      } else if (table.state === 'limpiando') {
        urgency = 'BAJA';
        score = 25;
        reason = 'Personal en proceso de desinfección y alistamiento.';
      }

      const route = this.getDispatchRoute(table.table_id);

      heap.insert({
        tableId: table.table_id,
        mappedNode: route.mappedNode,
        state: table.state,
        urgencyLevel: urgency,
        priorityScore: score,
        reason,
        routeFromKitchen: {
          reachable: route.reachable,
          path: route.path,
          transitSeconds: route.transitSeconds,
        },
      });
    }

    const prioritizedTasks: DispatchPriorityItem[] = [];
    while (!heap.isEmpty()) {
      const item = heap.extractMin();
      if (item) {
        prioritizedTasks.push(item);
      }
    }

    return {
      totalPendingTasks: prioritizedTasks.length,
      prioritizedTasks,
      algorithm: 'MinHeap (Binary Heap) con extracción prioritaria O(log n)',
    };
  }
}

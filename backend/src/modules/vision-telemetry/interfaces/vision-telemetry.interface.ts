export interface SalonSummary {
  total_tables: number;
  free_tables: number;
  occupied_tables: number;
  pending_clean_tables: number;
  cleaning_tables: number;
  temporary_absence_tables: number;
  occupancy_rate_percent: number;
}

export interface SalonKPISummary {
  avg_first_service_latency_seconds?: number | null;
  avg_turnover_latency_seconds?: number | null;
  avg_stay_duration_seconds?: number | null;
  hygiene_incidents_count: number;
  waiting_queue_count: number;
  service_bottleneck_detected: boolean;
  low_demand_detected: boolean;
  operational_diagnosis: string;
}

export interface TableTelemetry {
  table_id: string;
  state: string;
  current_session_id?: string | null;
  is_occupied: boolean;
  occupied_duration_seconds: number;
  occupied_duration_formatted: string;
  first_dish_served: boolean;
  has_hygiene_incident: boolean;
}

export interface IngestTelemetryPayload {
  system: string;
  timestamp: string;
  current_time_seconds: number;
  salon_summary: SalonSummary;
  kpis: SalonKPISummary;
  tables: TableTelemetry[];
}

export interface DispatchPriorityItem {
  tableId: string;
  mappedNode: string;
  state: string;
  urgencyLevel: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
  priorityScore: number;
  reason: string;
  routeFromKitchen: {
    reachable: boolean;
    path: string[];
    transitSeconds: number | null;
  };
}

export interface SalonStatusResponse {
  system: string;
  lastSyncTimestamp: string;
  currentTimeSeconds: number;
  salonSummary: SalonSummary;
  kpis: SalonKPISummary;
  tables: TableTelemetry[];
  activeAlerts: string[];
}

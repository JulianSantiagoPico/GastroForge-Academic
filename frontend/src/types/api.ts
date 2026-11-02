export type TimeseriesBucket = 'hour' | 'day';

export interface AnalyticsOverview {
  period: {
    from: number;
    to: number;
    fromDate: string;
    toDate: string;
  };
  transactions: {
    total: number;
    totalValue: number;
    averageValue: number;
    perDayAverage: number;
    perWeekAverage: number;
    perMonthAverage: number;
  };
  episodes: {
    total: number;
    open: number;
    closed: number;
    reviewed: number;
    dismissed: number;
  };
  fraud: {
    flaggedTransactions: number;
    suspiciousPercentage: number;
    affectedUsers: number;
    recurrentUsers: number;
    suspiciousTotalValue: number;
    averageSuspiciousValuePerUser: number;
  };
}

export interface TimeseriesPoint {
  bucketTime: string;
  timestamp: number;
  transactionCount: number;
  totalValue: number;
  anomalyCount: number;
  flaggedValue: number;
}

export interface AnalyticsTimeseries {
  period: {
    from: number;
    to: number;
    bucket: TimeseriesBucket;
  };
  data: TimeseriesPoint[];
}

export interface TimelineEvent {
  type: 'EPISODE_OPENED' | 'TRANSACTION_FLAGGED' | 'EPISODE_UPDATED' | 'EPISODE_CLOSED';
  timestamp: number;
  description?: string;
  idTxn?: string;
  value?: number;
  currency?: string;
  paymentMethod?: string;
}

export interface EpisodeTimeline {
  episode: {
    id: string;
    userId: string;
    rule: string;
    status: 'OPEN' | 'CLOSED' | 'REVIEWED' | 'DISMISSED';
    openedAt: number;
    updatedAt: number;
    closedAt?: number | null;
    transactionCount: number;
    transactionIds: string[];
    reviewedBy?: string | null;
    notes?: string | null;
  };
  events: TimelineEvent[];
}

export interface AnomalyEpisodeListItem {
  id: string;
  userId: string;
  rule: string;
  status: 'OPEN' | 'CLOSED' | 'REVIEWED' | 'DISMISSED';
  openedAt: number | string;
  updatedAt: number | string;
  closedAt?: number | string | null;
  transactionCount: number;
  transactionIds: string[];
  notes?: string | null;
}

export interface AnomalyListResponse {
  data: AnomalyEpisodeListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface SimulationBurstParams {
  user?: string;
  count: number;
  delayMs?: number;
  paymentMethod?: string;
}

export interface SimulationResultItem {
  idTxn: string;
  status: string;
  isDuplicate: boolean;
  latencyMs: number;
  anomaly: {
    detected: boolean;
    rule?: string;
    windowCount: number;
    threshold: number;
    timeBand?: string;
    episodeId?: string;
  };
}

export interface SimulationBurstResponse {
  summary: {
    sent: number;
    accepted: number;
    anomalies: number;
    avgLatencyMs: number;
    totalDurationMs: number;
    userId: string;
  };
  results: SimulationResultItem[];
}



// ==========================================
// GastroForge Vision Telemetry Types
// ==========================================

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
  avg_first_service_latency_seconds: number | null;
  avg_turnover_latency_seconds: number | null;
  avg_stay_duration_seconds: number | null;
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

export interface SalonStatusResponse {
  system: string;
  lastSyncTimestamp: string;
  currentTimeSeconds: number;
  salonSummary: SalonSummary;
  kpis: SalonKPISummary;
  tables: TableTelemetry[];
  activeAlerts: string[];
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

export interface ServicePriorityResponse {
  totalPendingTasks: number;
  prioritizedTasks: DispatchPriorityItem[];
  algorithm: string;
}

export interface DispatchRouteResponse {
  tableId: string;
  mappedNode: string;
  from: string;
  path: string[];
  transitSeconds: number | null;
  reachable: boolean;
}

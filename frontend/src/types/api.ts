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
  openedAt: number;
  updatedAt: number;
  closedAt?: number | null;
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


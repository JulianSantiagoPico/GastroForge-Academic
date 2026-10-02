import { IsOptional, IsString, IsIn } from 'class-validator';

export class OverviewQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export type TimeseriesBucket = 'hour' | 'day';

export class TimeseriesQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(['hour', 'day'], {
    message: 'El parámetro bucket debe ser "hour" o "day"',
  })
  bucket?: TimeseriesBucket;
}

export interface AnalyticsOverviewResponse {
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

export interface AnalyticsTimeseriesResponse {
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

export interface AnalyticsTimelineResponse {
  episode: {
    id: string;
    userId: string;
    rule: string;
    status: string;
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  OverviewQueryDto,
  TimeseriesQueryDto,
  TimeseriesBucket,
  AnalyticsOverviewResponse,
  AnalyticsTimeseriesResponse,
  AnalyticsTimelineResponse,
  TimeseriesPoint,
  TimelineEvent,
} from './dto/analytics-query.dto';
import { AppressoTransactionEntity } from '../persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from '../persistence/entities/anomaly-episode.entity';

@Injectable()
export class AppressoAnalyticsService {
  private readonly usesPostgres = !!process.env.DATABASE_URL;

  constructor(private readonly entityManager: EntityManager) {}

  /**
   * Resuelve el rango temporal en milisegundos UTC.
   */
  private resolveTimeRange(
    fromInput?: string,
    toInput?: string,
    defaultDurationMs = 30 * 24 * 3600 * 1000,
  ): { from: number; to: number } {
    const now = Date.now();
    let to = now;
    if (toInput) {
      const parsedTo = Number(toInput);
      to = !isNaN(parsedTo) && parsedTo > 0 ? parsedTo : Date.parse(toInput);
      if (isNaN(to)) to = now;
    }

    let from = to - defaultDurationMs;
    if (fromInput) {
      const parsedFrom = Number(fromInput);
      from = !isNaN(parsedFrom) && parsedFrom > 0 ? parsedFrom : Date.parse(fromInput);
      if (isNaN(from)) from = to - defaultDurationMs;
    }

    if (from > to) {
      const temp = from;
      from = to;
      to = temp;
    }

    return { from, to };
  }

  /**
   * GET /api/v1/appresso/analytics/overview
   */
  async getOverview(dto: OverviewQueryDto): Promise<AnalyticsOverviewResponse> {
    const { from, to } = this.resolveTimeRange(dto.from, dto.to, 30 * 24 * 3600 * 1000);
    const daysInRange = Math.max(1, (to - from) / (24 * 3600 * 1000));

    if (this.usesPostgres) {
      return await this.getPostgresOverview(from, to, daysInRange);
    }

    return await this.getInMemoryOverview(from, to, daysInRange);
  }

  private async getPostgresOverview(
    from: number,
    to: number,
    daysInRange: number,
  ): Promise<AnalyticsOverviewResponse> {
    // 1. Agregados sobre appresso_transactions utilizando índices en receivedAt
    const txnSql = `
      SELECT
        COUNT(*)::int AS total_txns,
        COALESCE(SUM(value), 0)::bigint AS total_value,
        COUNT(*) FILTER (WHERE "anomalyEpisodeId" IS NOT NULL)::int AS flagged_txns,
        COALESCE(SUM(value) FILTER (WHERE "anomalyEpisodeId" IS NOT NULL), 0)::bigint AS suspicious_val
      FROM appresso_transactions
      WHERE "receivedAt" >= $1 AND "receivedAt" <= $2;
    `;
    const [txnStats] = await this.entityManager.query(txnSql, [from, to]);

    // 2. Agregados sobre appresso_anomaly_episodes utilizando openedAt y status
    const epSql = `
      SELECT
        COUNT(*)::int AS total_episodes,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_episodes,
        COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed_episodes,
        COUNT(*) FILTER (WHERE status = 'REVIEWED')::int AS reviewed_episodes,
        COUNT(*) FILTER (WHERE status = 'DISMISSED')::int AS dismissed_episodes,
        COUNT(DISTINCT "userId")::int AS affected_users
      FROM appresso_anomaly_episodes
      WHERE "openedAt" >= $1 AND "openedAt" <= $2;
    `;
    const [epStats] = await this.entityManager.query(epSql, [from, to]);

    // 3. Usuarios recurrentes (>1 episodio en el periodo)
    const recSql = `
      SELECT COUNT(*)::int AS recurrent_users FROM (
        SELECT "userId"
        FROM appresso_anomaly_episodes
        WHERE "openedAt" >= $1 AND "openedAt" <= $2
        GROUP BY "userId"
        HAVING COUNT(*) > 1
      ) sub;
    `;
    const [recStats] = await this.entityManager.query(recSql, [from, to]);

    const totalTxns = Number(txnStats?.total_txns || 0);
    const totalValue = Number(txnStats?.total_value || 0);
    const flaggedTxns = Number(txnStats?.flagged_txns || 0);
    const suspiciousValue = Number(txnStats?.suspicious_val || 0);

    const totalEpisodes = Number(epStats?.total_episodes || 0);
    const openEpisodes = Number(epStats?.open_episodes || 0);
    const closedEpisodes = Number(epStats?.closed_episodes || 0);
    const reviewedEpisodes = Number(epStats?.reviewed_episodes || 0);
    const dismissedEpisodes = Number(epStats?.dismissed_episodes || 0);
    const affectedUsers = Number(epStats?.affected_users || 0);
    const recurrentUsers = Number(recStats?.recurrent_users || 0);

    return {
      period: {
        from,
        to,
        fromDate: new Date(from).toISOString(),
        toDate: new Date(to).toISOString(),
      },
      transactions: {
        total: totalTxns,
        totalValue,
        averageValue: totalTxns > 0 ? Math.round(totalValue / totalTxns) : 0,
        perDayAverage: Number((totalTxns / daysInRange).toFixed(2)),
        perWeekAverage: Number(((totalTxns / daysInRange) * 7).toFixed(2)),
        perMonthAverage: Number(((totalTxns / daysInRange) * 30).toFixed(2)),
      },
      episodes: {
        total: totalEpisodes,
        open: openEpisodes,
        closed: closedEpisodes,
        reviewed: reviewedEpisodes,
        dismissed: dismissedEpisodes,
      },
      fraud: {
        flaggedTransactions: flaggedTxns,
        suspiciousPercentage:
          totalTxns > 0 ? Number(((flaggedTxns / totalTxns) * 100).toFixed(2)) : 0,
        affectedUsers,
        recurrentUsers,
        suspiciousTotalValue: suspiciousValue,
        averageSuspiciousValuePerUser:
          affectedUsers > 0 ? Math.round(suspiciousValue / affectedUsers) : 0,
      },
    };
  }

  private async getInMemoryOverview(
    from: number,
    to: number,
    daysInRange: number,
  ): Promise<AnalyticsOverviewResponse> {
    const txnRepo = this.entityManager.getRepository(AppressoTransactionEntity);
    const epRepo = this.entityManager.getRepository(AppressoAnomalyEpisodeEntity);

    const allTxns: AppressoTransactionEntity[] = (await txnRepo.find()) || [];
    const allEps: AppressoAnomalyEpisodeEntity[] = (await epRepo.find()) || [];

    const txns = allTxns.filter(
      (t) => Number(t.receivedAt) >= from && Number(t.receivedAt) <= to,
    );
    const eps = allEps.filter(
      (e) => Number(e.openedAt) >= from && Number(e.openedAt) <= to,
    );

    const totalTxns = txns.length;
    let totalValue = 0;
    let flaggedTxns = 0;
    let suspiciousValue = 0;

    for (const t of txns) {
      const val = Number(t.value);
      totalValue += val;
      if (t.anomalyEpisodeId) {
        flaggedTxns++;
        suspiciousValue += val;
      }
    }

    let openEpisodes = 0;
    let closedEpisodes = 0;
    let reviewedEpisodes = 0;
    let dismissedEpisodes = 0;
    const userEpisodeCounts = new Map<string, number>();

    for (const ep of eps) {
      if (ep.status === 'OPEN') openEpisodes++;
      else if (ep.status === 'CLOSED') closedEpisodes++;
      else if (ep.status === 'REVIEWED') reviewedEpisodes++;
      else if (ep.status === 'DISMISSED') dismissedEpisodes++;

      userEpisodeCounts.set(ep.userId, (userEpisodeCounts.get(ep.userId) || 0) + 1);
    }

    const affectedUsers = userEpisodeCounts.size;
    let recurrentUsers = 0;
    for (const count of userEpisodeCounts.values()) {
      if (count > 1) recurrentUsers++;
    }

    return {
      period: {
        from,
        to,
        fromDate: new Date(from).toISOString(),
        toDate: new Date(to).toISOString(),
      },
      transactions: {
        total: totalTxns,
        totalValue,
        averageValue: totalTxns > 0 ? Math.round(totalValue / totalTxns) : 0,
        perDayAverage: Number((totalTxns / daysInRange).toFixed(2)),
        perWeekAverage: Number(((totalTxns / daysInRange) * 7).toFixed(2)),
        perMonthAverage: Number(((totalTxns / daysInRange) * 30).toFixed(2)),
      },
      episodes: {
        total: eps.length,
        open: openEpisodes,
        closed: closedEpisodes,
        reviewed: reviewedEpisodes,
        dismissed: dismissedEpisodes,
      },
      fraud: {
        flaggedTransactions: flaggedTxns,
        suspiciousPercentage:
          totalTxns > 0 ? Number(((flaggedTxns / totalTxns) * 100).toFixed(2)) : 0,
        affectedUsers,
        recurrentUsers,
        suspiciousTotalValue: suspiciousValue,
        averageSuspiciousValuePerUser:
          affectedUsers > 0 ? Math.round(suspiciousValue / affectedUsers) : 0,
      },
    };
  }

  /**
   * GET /api/v1/appresso/analytics/timeseries
   */
  async getTimeseries(dto: TimeseriesQueryDto): Promise<AnalyticsTimeseriesResponse> {
    const bucket: TimeseriesBucket = dto.bucket === 'day' ? 'day' : 'hour';
    const defaultDurationMs =
      bucket === 'day' ? 30 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
    const { from, to } = this.resolveTimeRange(dto.from, dto.to, defaultDurationMs);

    if (this.usesPostgres) {
      return await this.getPostgresTimeseries(from, to, bucket);
    }

    return await this.getInMemoryTimeseries(from, to, bucket);
  }

  private async getPostgresTimeseries(
    from: number,
    to: number,
    bucket: TimeseriesBucket,
  ): Promise<AnalyticsTimeseriesResponse> {
    const pgBucket = bucket === 'day' ? 'day' : 'hour';
    const sql = `
      SELECT
        date_trunc('${pgBucket}', to_timestamp("receivedAt" / 1000.0) AT TIME ZONE 'UTC') AS bucket_date,
        (EXTRACT(EPOCH FROM date_trunc('${pgBucket}', to_timestamp("receivedAt" / 1000.0) AT TIME ZONE 'UTC')) * 1000)::bigint AS bucket_ts,
        COUNT(*)::int AS txn_count,
        COALESCE(SUM(value), 0)::bigint AS total_val,
        COUNT(*) FILTER (WHERE "anomalyEpisodeId" IS NOT NULL)::int AS anomaly_count,
        COALESCE(SUM(value) FILTER (WHERE "anomalyEpisodeId" IS NOT NULL), 0)::bigint AS flagged_val
      FROM appresso_transactions
      WHERE "receivedAt" >= $1 AND "receivedAt" <= $2
      GROUP BY 1, 2
      ORDER BY bucket_date ASC;
    `;

    const rows = await this.entityManager.query(sql, [from, to]);
    const data: TimeseriesPoint[] = rows.map((r: any) => ({
      bucketTime: new Date(Number(r.bucket_ts)).toISOString(),
      timestamp: Number(r.bucket_ts),
      transactionCount: Number(r.txn_count),
      totalValue: Number(r.total_val),
      anomalyCount: Number(r.anomaly_count),
      flaggedValue: Number(r.flagged_val),
    }));

    return {
      period: { from, to, bucket },
      data,
    };
  }

  private async getInMemoryTimeseries(
    from: number,
    to: number,
    bucket: TimeseriesBucket,
  ): Promise<AnalyticsTimeseriesResponse> {
    const txnRepo = this.entityManager.getRepository(AppressoTransactionEntity);
    const allTxns: AppressoTransactionEntity[] = (await txnRepo.find()) || [];
    const txns = allTxns.filter(
      (t) => Number(t.receivedAt) >= from && Number(t.receivedAt) <= to,
    );

    const stepMs = bucket === 'day' ? 24 * 3600 * 1000 : 3600 * 1000;
    const bucketMap = new Map<number, TimeseriesPoint>();

    for (const t of txns) {
      const rec = Number(t.receivedAt);
      const bucketTs = Math.floor(rec / stepMs) * stepMs;
      let point = bucketMap.get(bucketTs);
      if (!point) {
        point = {
          bucketTime: new Date(bucketTs).toISOString(),
          timestamp: bucketTs,
          transactionCount: 0,
          totalValue: 0,
          anomalyCount: 0,
          flaggedValue: 0,
        };
        bucketMap.set(bucketTs, point);
      }

      point.transactionCount++;
      point.totalValue += Number(t.value);
      if (t.anomalyEpisodeId) {
        point.anomalyCount++;
        point.flaggedValue += Number(t.value);
      }
    }

    const data = Array.from(bucketMap.values()).sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    return {
      period: { from, to, bucket },
      data,
    };
  }

  /**
   * GET /api/v1/appresso/analytics/anomalies/:id/timeline
   */
  async getEpisodeTimeline(episodeId: string): Promise<AnalyticsTimelineResponse> {
    const epRepo = this.entityManager.getRepository(AppressoAnomalyEpisodeEntity);
    const txnRepo = this.entityManager.getRepository(AppressoTransactionEntity);

    const episode = await epRepo.findOne({ where: { id: episodeId } });
    if (!episode) {
      throw new NotFoundException(`Episodio de anomalía ${episodeId} no encontrado`);
    }

    // Buscar transacciones asociadas a este episodio
    let txns: AppressoTransactionEntity[] = [];
    if (this.usesPostgres) {
      txns = await txnRepo.find({
        where: { anomalyEpisodeId: episodeId },
        order: { receivedAt: 'ASC' },
      });
      // Fallback si anomalyEpisodeId aún no está enlazado en transacciones previas
      if (txns.length === 0 && episode.transactionIds?.length > 0) {
        txns = await this.entityManager.query(
          `SELECT * FROM appresso_transactions WHERE "idTxn" = ANY($1) ORDER BY "receivedAt" ASC`,
          [episode.transactionIds],
        );
      }
    } else {
      const allTxns: AppressoTransactionEntity[] = (await txnRepo.find()) || [];
      txns = allTxns
        .filter(
          (t) =>
            t.anomalyEpisodeId === episodeId ||
            episode.transactionIds?.includes(t.idTxn),
        )
        .sort((a, b) => Number(a.receivedAt) - Number(b.receivedAt));
    }

    const events: TimelineEvent[] = [];

    // 1. Evento de apertura
    events.push({
      type: 'EPISODE_OPENED',
      timestamp: Number(episode.openedAt),
      description: `Episodio abierto por regla ${episode.rule}`,
    });

    // 2. Transacciones involucradas
    for (const t of txns) {
      events.push({
        type: 'TRANSACTION_FLAGGED',
        timestamp: Number(t.receivedAt),
        idTxn: t.idTxn,
        value: Number(t.value),
        currency: t.currency,
        paymentMethod: t.paymentMethod,
        description: `Transacción ${t.idTxn} vinculada a la ventana sospechosa`,
      });
    }

    // 3. Evento de actualización si hubo transacciones posteriores
    if (
      episode.updatedAt &&
      Number(episode.updatedAt) > Number(episode.openedAt)
    ) {
      events.push({
        type: 'EPISODE_UPDATED',
        timestamp: Number(episode.updatedAt),
        description: `Episodio actualizado con ${episode.transactionCount} transacciones registradas`,
      });
    }

    // 4. Evento de cierre si el episodio está cerrado
    if (episode.closedAt) {
      events.push({
        type: 'EPISODE_CLOSED',
        timestamp: Number(episode.closedAt),
        description: `Episodio finalizado con estado ${episode.status}`,
      });
    }

    // Ordenar cronológicamente (priorizando apertura sobre transacciones al mismo timestamp)
    const orderPriority: Record<TimelineEvent['type'], number> = {
      EPISODE_OPENED: 1,
      TRANSACTION_FLAGGED: 2,
      EPISODE_UPDATED: 3,
      EPISODE_CLOSED: 4,
    };

    events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return orderPriority[a.type] - orderPriority[b.type];
    });

    return {
      episode: {
        id: episode.id,
        userId: episode.userId,
        rule: episode.rule,
        status: episode.status,
        openedAt: Number(episode.openedAt),
        updatedAt: Number(episode.updatedAt),
        closedAt: episode.closedAt ? Number(episode.closedAt) : null,
        transactionCount: episode.transactionCount,
        transactionIds: episode.transactionIds || [],
        reviewedBy: episode.reviewedBy || null,
        notes: episode.notes || null,
      },
      events,
    };
  }
}

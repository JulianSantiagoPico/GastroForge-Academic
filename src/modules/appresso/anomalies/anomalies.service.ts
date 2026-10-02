import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppressoAnomalyEpisodeEntity } from '../persistence/entities/anomaly-episode.entity';
import { EpisodeStatus } from './anomaly-episode';

export interface QueryAnomaliesFilter {
  userId?: string;
  status?: EpisodeStatus;
  fromTimestamp?: number;
  toTimestamp?: number;
  page?: number;
  limit?: number;
}

export interface AnomaliesSummary {
  totalEpisodes: number;
  openEpisodes: number;
  closedEpisodes: number;
  reviewedEpisodes: number;
  dismissedEpisodes: number;
  totalFlaggedTransactions: number;
}

@Injectable()
export class AnomaliesService {
  constructor(
    @InjectRepository(AppressoAnomalyEpisodeEntity)
    private readonly episodeRepo: Repository<AppressoAnomalyEpisodeEntity>,
  ) {}

  /**
   * Consulta paginada de episodios de anomalías con filtros opcionales (A5.1).
   */
  async getAnomalies(filter: QueryAnomaliesFilter) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query = this.episodeRepo.createQueryBuilder('ep');

    if (filter.userId) {
      query.andWhere('ep.userId = :userId', { userId: filter.userId });
    }
    if (filter.status) {
      query.andWhere('ep.status = :status', { status: filter.status });
    }
    if (filter.fromTimestamp) {
      query.andWhere('ep.openedAt >= :from', { from: filter.fromTimestamp });
    }
    if (filter.toTimestamp) {
      query.andWhere('ep.openedAt <= :to', { to: filter.toTimestamp });
    }

    query.orderBy('ep.openedAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Métricas agregadas de anomalías calculadas en base de datos sin cargar historial a memoria (A5.2).
   */
  async getSummary(): Promise<AnomaliesSummary> {
    const raw = await this.episodeRepo.query(`
      SELECT 
        COUNT(*) AS total_episodes,
        COUNT(*) FILTER (WHERE status = 'OPEN') AS open_episodes,
        COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed_episodes,
        COUNT(*) FILTER (WHERE status = 'REVIEWED') AS reviewed_episodes,
        COUNT(*) FILTER (WHERE status = 'DISMISSED') AS dismissed_episodes,
        COALESCE(SUM("transactionCount"), 0) AS total_flagged_transactions
      FROM appresso_anomaly_episodes
    `);

    const row = raw[0] || {};
    return {
      totalEpisodes: parseInt(row.total_episodes || '0', 10),
      openEpisodes: parseInt(row.open_episodes || '0', 10),
      closedEpisodes: parseInt(row.closed_episodes || '0', 10),
      reviewedEpisodes: parseInt(row.reviewed_episodes || '0', 10),
      dismissedEpisodes: parseInt(row.dismissed_episodes || '0', 10),
      totalFlaggedTransactions: parseInt(row.total_flagged_transactions || '0', 10),
    };
  }

  /**
   * Transiciona el estado de un episodio aplicando la regla inviolable:
   * Un episodio CLOSED NUNCA se reabre (A1.2a, A5.3).
   */
  async updateStatus(
    id: string,
    newStatus: EpisodeStatus,
    reviewerOrNotes?: string,
  ): Promise<AppressoAnomalyEpisodeEntity> {
    const episode = await this.episodeRepo.findOne({ where: { id } });
    if (!episode) {
      throw new NotFoundException(`Episodio de anomalía no encontrado: ${id}`);
    }

    if (episode.status === EpisodeStatus.CLOSED && newStatus === EpisodeStatus.OPEN) {
      throw new BadRequestException(
        'Regla de negocio A1.2a: Un episodio CLOSED nunca se reabre. Nuevas detecciones crean un episodio nuevo.',
      );
    }

    episode.status = newStatus;
    if (newStatus === EpisodeStatus.REVIEWED) {
      episode.reviewedBy = reviewerOrNotes;
    } else if (newStatus === EpisodeStatus.DISMISSED) {
      episode.notes = reviewerOrNotes;
    } else if (newStatus === EpisodeStatus.CLOSED) {
      episode.closedAt = Date.now();
    }

    return await this.episodeRepo.save(episode);
  }
}

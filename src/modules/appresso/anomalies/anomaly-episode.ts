import * as crypto from 'crypto';

export enum EpisodeStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
}

export interface AnomalyEpisode {
  id: string;
  userId: string;
  rule: string;
  status: EpisodeStatus;
  openedAt: number;
  updatedAt: number;
  closedAt?: number;
  transactionCount: number;
  transactionIds: string[];
  reviewedBy?: string;
  notes?: string;
}

export interface RecordAnomalyInput {
  userId: string;
  rule: string;
  txnId: string;
  timestamp: number;
  windowTxnIds: string[];
}

export interface AnomalyEpisodeManagerConfig {
  windowMs: number;
}

/**
 * Gestor del ciclo de vida de episodios de anomalías (A1.2a).
 *
 * Reglas fundamentales:
 * 1. Clave de deduplicación: `(userId, rule)`.
 * 2. Mientras un episodio esté OPEN, se actualiza en lugar de generar una nueva alerta por transacción.
 * 3. Un episodio CLOSED NUNCA se reabre; nuevos cruces de umbral generan un nuevo episodio.
 * 4. El cierre ocurre cuando no quedan eventos vigentes en la ventana (now - updatedAt > windowMs).
 */
export class AnomalyEpisodeManager {
  private readonly windowMs: number;
  private readonly episodesById = new Map<string, AnomalyEpisode>();
  private readonly openEpisodeByKey = new Map<string, string>(); // `userId:rule` -> episodeId
  private readonly episodesByUserAndRule = new Map<string, string[]>(); // `userId:rule` -> episodeIds

  constructor(config: AnomalyEpisodeManagerConfig) {
    this.windowMs = config.windowMs;
  }

  private getKey(userId: string, rule: string): string {
    return `${userId}:${rule}`;
  }

  /**
   * Registra una anomalía detectada. Si ya existe un episodio OPEN para (usuario, regla),
   * lo actualiza. Si no existe o está CLOSED, crea uno nuevo.
   */
  recordAnomaly(input: RecordAnomalyInput): AnomalyEpisode {
    const key = this.getKey(input.userId, input.rule);
    const existingOpenId = this.openEpisodeByKey.get(key);

    if (existingOpenId) {
      const existing = this.episodesById.get(existingOpenId);
      if (existing && existing.status === EpisodeStatus.OPEN) {
        existing.updatedAt = input.timestamp;
        const set = new Set([...existing.transactionIds, ...input.windowTxnIds, input.txnId]);
        existing.transactionIds = Array.from(set);
        existing.transactionCount = existing.transactionIds.length;
        return existing;
      }
    }

    // Crear nuevo episodio OPEN
    const id = crypto.randomUUID ? crypto.randomUUID() : `ep-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newEpisode: AnomalyEpisode = {
      id,
      userId: input.userId,
      rule: input.rule,
      status: EpisodeStatus.OPEN,
      openedAt: input.timestamp,
      updatedAt: input.timestamp,
      transactionIds: Array.from(new Set([...input.windowTxnIds, input.txnId])),
      transactionCount: Array.from(new Set([...input.windowTxnIds, input.txnId])).length,
    };

    this.episodesById.set(id, newEpisode);
    this.openEpisodeByKey.set(key, id);

    let list = this.episodesByUserAndRule.get(key);
    if (!list) {
      list = [];
      this.episodesByUserAndRule.set(key, list);
    }
    list.push(id);

    return newEpisode;
  }

  /**
   * Cierra episodios OPEN cuyos eventos hayan expirado (now - updatedAt > windowMs).
   */
  checkAndCloseExpired(now: number): void {
    for (const [key, episodeId] of this.openEpisodeByKey.entries()) {
      const episode = this.episodesById.get(episodeId);
      if (episode && episode.status === EpisodeStatus.OPEN) {
        if (now - episode.updatedAt > this.windowMs) {
          episode.status = EpisodeStatus.CLOSED;
          episode.closedAt = now;
          this.openEpisodeByKey.delete(key);
        }
      }
    }
  }

  /**
   * Transiciona el estado de un episodio a REVIEWED o DISMISSED con metadatos.
   */
  transitionStatus(
    episodeId: string,
    newStatus: EpisodeStatus,
    reviewerOrNotes?: string,
  ): AnomalyEpisode {
    const episode = this.episodesById.get(episodeId);
    if (!episode) {
      throw new Error(`Episodio no encontrado: ${episodeId}`);
    }

    episode.status = newStatus;
    if (newStatus === EpisodeStatus.REVIEWED) {
      episode.reviewedBy = reviewerOrNotes;
    } else if (newStatus === EpisodeStatus.DISMISSED) {
      episode.notes = reviewerOrNotes;
    }

    // Si estaba OPEN y pasa a REVIEWED o DISMISSED, se desasocia de la clave activa
    const key = this.getKey(episode.userId, episode.rule);
    if (this.openEpisodeByKey.get(key) === episodeId) {
      this.openEpisodeByKey.delete(key);
    }

    return episode;
  }

  getEpisodeById(id: string): AnomalyEpisode | undefined {
    return this.episodesById.get(id);
  }

  getLatestEpisode(userId: string, rule: string): AnomalyEpisode | undefined {
    const key = this.getKey(userId, rule);
    const list = this.episodesByUserAndRule.get(key);
    if (!list || list.length === 0) return undefined;
    return this.episodesById.get(list[list.length - 1]);
  }

  getAllEpisodes(): AnomalyEpisode[] {
    return Array.from(this.episodesById.values());
  }
}

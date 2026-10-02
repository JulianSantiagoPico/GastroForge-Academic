import { Injectable } from '@nestjs/common';
import { AppressoTransactionEntity } from './entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from './entities/anomaly-episode.entity';

/**
 * Adaptador de persistencia en memoria para entornos locales y scripts académicos
 * cuando no se encuentra configurada la variable DATABASE_URL (A1.0 Opción A / fallback).
 */
@Injectable()
export class InMemoryEntityManager {
  private transactions = new Map<string, AppressoTransactionEntity>();
  private episodes = new Map<string, AppressoAnomalyEpisodeEntity>();

  async query(sql: string, params?: any[]): Promise<any[]> {
    if (sql.includes('COUNT(*) AS total_episodes')) {
      const all = Array.from(this.episodes.values());
      const open = all.filter((e) => e.status === 'OPEN').length;
      const closed = all.filter((e) => e.status === 'CLOSED').length;
      const reviewed = all.filter((e) => e.status === 'REVIEWED').length;
      const dismissed = all.filter((e) => e.status === 'DISMISSED').length;
      const totalFlagged = all.reduce((sum, e) => sum + (e.transactionCount || 0), 0);
      return [
        {
          total_episodes: String(all.length),
          open_episodes: String(open),
          closed_episodes: String(closed),
          reviewed_episodes: String(reviewed),
          dismissed_episodes: String(dismissed),
          total_flagged_transactions: String(totalFlagged),
        },
      ];
    }
    return [];
  }

  async transaction<T>(runInTransaction: (entityManager: InMemoryEntityManager) => Promise<T>): Promise<T> {
    return await runInTransaction(this);
  }

  /**
   * Devuelve un repositorio con el subconjunto de la API de TypeORM que usa el módulo.
   *
   * El tipo de retorno es `any` a propósito: las operaciones se despachan por la clase de entidad
   * que se solicita y este adaptador no puede expresar un `Repository<T>` real. La interfaz es la
   * que el módulo consume, no la superficie completa de TypeORM.
   */
  getRepository(entity: any): any {
    const isTxn = entity === AppressoTransactionEntity || entity?.name === 'AppressoTransactionEntity';
    const isEpisode = entity === AppressoAnomalyEpisodeEntity || entity?.name === 'AppressoAnomalyEpisodeEntity';

    if (isTxn) {
      return {
        create: (dto: any) => ({ ...dto }),
        findOne: async ({ where }: any) => {
          if (where?.idTxn) {
            return this.transactions.get(where.idTxn) || null;
          }
          return null;
        },
        save: async (entityToSave: AppressoTransactionEntity) => {
          const id = entityToSave.id || `txn-uuid-${Date.now()}`;
          const saved = { ...entityToSave, id };
          this.transactions.set(saved.idTxn, saved as any);
          return saved;
        },
        find: async () => Array.from(this.transactions.values()),
      };
    }

    if (isEpisode) {
      return {
        create: (dto: any) => ({ ...dto }),
        findOne: async ({ where }: any) => {
          for (const ep of this.episodes.values()) {
            if (where.id && ep.id === where.id) return ep;
            if (
              where.userId === ep.userId &&
              where.rule === ep.rule &&
              where.status === ep.status
            ) {
              return ep;
            }
          }
          return null;
        },
        find: async ({ where }: any = {}) => {
          const all = Array.from(this.episodes.values());
          if (!where || where.status === undefined) {
            return all;
          }
          // El repositorio real filtra en SQL; aquí el filtro se aplica en memoria. Suficiente
          // para un fallback de desarrollo, no para reproducibilidad de carga.
          return all.filter((ep) => ep.status === where.status);
        },
        save: async (entityToSave: AppressoAnomalyEpisodeEntity) => {
          const id = entityToSave.id || `ep-uuid-${Date.now()}`;
          const saved = { ...entityToSave, id };
          this.episodes.set(saved.id, saved as any);
          return saved;
        },
        createQueryBuilder: () => {
          const list = Array.from(this.episodes.values());
          return {
            andWhere: () => this,
            orderBy: () => this,
            skip: () => this,
            take: () => this,
            getManyAndCount: async () => [list, list.length],
          };
        },
        query: (sql: string) => this.query(sql),
      };
    }

    return null;
  }
}

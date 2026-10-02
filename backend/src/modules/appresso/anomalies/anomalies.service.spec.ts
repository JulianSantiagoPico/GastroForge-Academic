import { AnomaliesService } from './anomalies.service';
import { EpisodeStatus } from './anomaly-episode';
import { AppressoMetricsService, METRIC } from '../metrics/appresso-metrics.service';
import { APPRESSO_WINDOW_MS } from '../appresso.constants';

describe('AnomaliesService (A5.1 - A5.3)', () => {
  let service: AnomaliesService;
  let metrics: AppressoMetricsService;
  let mockRepo: any;
  const mockEpisodes: any[] = [];

  beforeEach(() => {
    mockEpisodes.length = 0;
    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockImplementation(async () => {
          return [mockEpisodes, mockEpisodes.length];
        }),
      }),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        return mockEpisodes.find((ep) => ep.id === where.id) || null;
      }),
      find: jest.fn().mockImplementation(async ({ where }: any = {}) => {
        if (!where || where.status === undefined) {
          return [...mockEpisodes];
        }
        return mockEpisodes.filter((ep) => ep.status === where.status);
      }),
      save: jest.fn().mockImplementation(async (entity: any) => {
        const idx = mockEpisodes.findIndex((e) => e.id === entity.id);
        if (idx >= 0) mockEpisodes[idx] = entity;
        else mockEpisodes.push(entity);
        return entity;
      }),
      query: jest.fn().mockResolvedValue([
        {
          total_episodes: '5',
          open_episodes: '2',
          closed_episodes: '2',
          reviewed_episodes: '1',
          dismissed_episodes: '0',
          total_flagged_transactions: '18',
        },
      ]),
    };

    metrics = new AppressoMetricsService();
    service = new AnomaliesService(mockRepo, metrics);
  });

  it('lista episodios paginados con filtros', async () => {
    mockEpisodes.push({
      id: 'ep-1',
      userId: 'user-01',
      rule: 'POSIBLE_FRAUDE',
      status: EpisodeStatus.OPEN,
      transactionCount: 3,
    });

    const result = await service.getAnomalies({ page: 1, limit: 10 });
    expect(result.data.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('normaliza campos bigint devueltos como string por PostgreSQL a números', async () => {
    const now = Date.now();
    mockEpisodes.push({
      id: 'ep-pg-1',
      userId: 'user-02',
      rule: 'POSIBLE_FRAUDE',
      status: EpisodeStatus.OPEN,
      openedAt: '1772658192000',
      updatedAt: String(now),
      closedAt: null,
      transactionCount: '5',
    });
    mockEpisodes.push({
      id: 'ep-pg-2',
      userId: 'user-03',
      rule: 'POSIBLE_FRAUDE',
      status: EpisodeStatus.CLOSED,
      openedAt: '1772658190000',
      updatedAt: '1772658200000',
      closedAt: '1772658300000',
      transactionCount: '10',
    });

    const result = await service.getAnomalies({ page: 1, limit: 10 });
    const ep1 = result.data.find((e) => e.id === 'ep-pg-1');
    expect(ep1).toBeDefined();
    expect(typeof ep1?.openedAt).toBe('number');
    expect(ep1?.openedAt).toBe(1772658192000);
    expect(typeof ep1?.updatedAt).toBe('number');
    expect(ep1?.closedAt).toBeNull();
    expect(typeof ep1?.transactionCount).toBe('number');
    expect(ep1?.transactionCount).toBe(5);

    const ep2 = result.data.find((e) => e.id === 'ep-pg-2');
    expect(ep2).toBeDefined();
    expect(typeof ep2?.closedAt).toBe('number');
    expect(ep2?.closedAt).toBe(1772658300000);
    expect(ep2?.transactionCount).toBe(10);
  });

  it('obtiene resumen estadístico agregado de anomalías', async () => {
    const summary = await service.getSummary();
    expect(summary.totalEpisodes).toBe(5);
    expect(summary.openEpisodes).toBe(2);
    expect(summary.totalFlaggedTransactions).toBe(18);
  });

  it('actualiza el estado de un episodio a REVIEWED registrando auditoría', async () => {
    const ep = {
      id: 'ep-target',
      userId: 'user-01',
      status: EpisodeStatus.OPEN,
    };
    mockEpisodes.push(ep);

    const updated = await service.updateStatus('ep-target', EpisodeStatus.REVIEWED, 'Supervisor Juan');
    expect(updated.status).toBe(EpisodeStatus.REVIEWED);
    expect(updated.reviewedBy).toBe('Supervisor Juan');
  });

  it('impide la reapertura de un episodio CLOSED', async () => {
    const ep = {
      id: 'ep-closed',
      userId: 'user-01',
      status: EpisodeStatus.CLOSED,
    };
    mockEpisodes.push(ep);

    await expect(
      service.updateStatus('ep-closed', EpisodeStatus.OPEN),
    ).rejects.toThrow(/un episodio CLOSED nunca se reabre/i);
  });

  describe('cierre de episodios expirados (C6.0 - C6.1)', () => {
    it('cierra un episodio OPEN cuyos eventos ya no están vigentes', async () => {
      const now = 1_000_000;
      mockEpisodes.push({
        id: 'ep-stale',
        userId: 'user-01',
        rule: 'POSIBLE_FRAUDE',
        status: EpisodeStatus.OPEN,
        updatedAt: now - APPRESSO_WINDOW_MS - 1,
        transactionCount: 3,
      });

      const closed = await service.closeExpiredEpisodes(now);

      expect(closed).toBe(1);
      expect(mockEpisodes[0].status).toBe(EpisodeStatus.CLOSED);
      expect(mockEpisodes[0].closedAt).toBe(now);
      expect(metrics.snapshot().counters[METRIC.EPISODES_CLOSED]).toBe(1);
    });

    it('respeta el borde exacto: updatedAt === now - W sigue vigente (comparación estricta)', async () => {
      const now = 2_000_000;
      mockEpisodes.push({
        id: 'ep-boundary',
        userId: 'user-01',
        rule: 'POSIBLE_FRAUDE',
        status: EpisodeStatus.OPEN,
        updatedAt: now - APPRESSO_WINDOW_MS,
        transactionCount: 3,
      });

      const closed = await service.closeExpiredEpisodes(now);

      expect(closed).toBe(0);
      expect(mockEpisodes[0].status).toBe(EpisodeStatus.OPEN);
      expect(mockEpisodes[0].closedAt).toBeUndefined();
    });

    it('nunca reescribe un episodio ya cerrado, revisado o descartado', async () => {
      const now = 3_000_000;
      for (const status of [
        EpisodeStatus.CLOSED,
        EpisodeStatus.REVIEWED,
        EpisodeStatus.DISMISSED,
      ]) {
        mockEpisodes.push({
          id: `ep-${status}`,
          userId: 'user-01',
          rule: 'POSIBLE_FRAUDE',
          status,
          updatedAt: now - APPRESSO_WINDOW_MS - 5000,
          transactionCount: 3,
        });
      }

      const closed = await service.closeExpiredEpisodes(now);

      expect(closed).toBe(0);
      expect(mockEpisodes.every((ep) => ep.closedAt === undefined)).toBe(true);
    });

    it('cierra episodios vencidos antes de devolver un listado', async () => {
      const now = Date.now();
      mockEpisodes.push({
        id: 'ep-listing',
        userId: 'user-01',
        rule: 'POSIBLE_FRAUDE',
        status: EpisodeStatus.OPEN,
        updatedAt: now - APPRESSO_WINDOW_MS - 1,
        transactionCount: 3,
      });

      await service.getAnomalies({ page: 1, limit: 10 });

      expect(mockEpisodes[0].status).toBe(EpisodeStatus.CLOSED);
    });
  });
});
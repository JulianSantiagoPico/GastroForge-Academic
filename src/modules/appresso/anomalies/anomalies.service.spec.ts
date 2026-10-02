import { AnomaliesService } from './anomalies.service';
import { EpisodeStatus } from './anomaly-episode';

describe('AnomaliesService (A5.1 - A5.3)', () => {
  let service: AnomaliesService;
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

    service = new AnomaliesService(mockRepo);
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
});

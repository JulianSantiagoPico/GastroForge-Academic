import { NotFoundException } from '@nestjs/common';
import { AppressoAnalyticsService } from './analytics.service';
import { AppressoTransactionEntity } from '../persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from '../persistence/entities/anomaly-episode.entity';
import { EpisodeStatus } from '../anomalies/anomaly-episode';

describe('AppressoAnalyticsService (W4)', () => {
  let service: AppressoAnalyticsService;
  let mockEntityManager: any;
  let mockTxnRepo: any;
  let mockEpisodeRepo: any;

  let storedTxns: AppressoTransactionEntity[];
  let storedEpisodes: AppressoAnomalyEpisodeEntity[];

  beforeEach(() => {
    delete process.env.DATABASE_URL;

    storedTxns = [
      {
        id: 'txn-uuid-1',
        idTxn: 't-1',
        userId: 'user-A',
        value: 10000,
        currency: 'COP',
        paymentMethod: 'DEBIT_CARD',
        declaredDate: new Date(),
        receivedAt: 1000000,
        hmacSignature: 'sig1',
        createdAt: new Date(),
      } as any,
      {
        id: 'txn-uuid-2',
        idTxn: 't-2',
        userId: 'user-A',
        value: 15000,
        currency: 'COP',
        paymentMethod: 'DEBIT_CARD',
        declaredDate: new Date(),
        receivedAt: 1001000,
        hmacSignature: 'sig2',
        anomalyEpisodeId: 'ep-uuid-1',
        createdAt: new Date(),
      } as any,
      {
        id: 'txn-uuid-3',
        idTxn: 't-3',
        userId: 'user-B',
        value: 30000,
        currency: 'COP',
        paymentMethod: 'CREDIT_CARD',
        declaredDate: new Date(),
        receivedAt: 2000000,
        hmacSignature: 'sig3',
        createdAt: new Date(),
      } as any,
    ];

    storedEpisodes = [
      {
        id: 'ep-uuid-1',
        userId: 'user-A',
        rule: 'POSIBLE_FRAUDE_VENTANA_DESLIZANTE',
        status: EpisodeStatus.CLOSED,
        openedAt: 1001000,
        updatedAt: 1002000,
        closedAt: 1005000,
        transactionCount: 2,
        transactionIds: ['t-1', 't-2'],
        notes: '{"source":"redis"}',
        createdAt: new Date(),
        recordUpdatedAt: new Date(),
      } as any,
      {
        id: 'ep-uuid-2',
        userId: 'user-A',
        rule: 'POSIBLE_FRAUDE_VENTANA_DESLIZANTE',
        status: EpisodeStatus.OPEN,
        openedAt: 1050000,
        updatedAt: 1050000,
        transactionCount: 1,
        transactionIds: ['t-extra'],
        createdAt: new Date(),
        recordUpdatedAt: new Date(),
      } as any,
    ];

    mockTxnRepo = {
      find: jest.fn().mockImplementation(async () => storedTxns),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        return storedTxns.find((t) => t.id === where?.id || t.idTxn === where?.idTxn) || null;
      }),
    };

    mockEpisodeRepo = {
      find: jest.fn().mockImplementation(async () => storedEpisodes),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        return storedEpisodes.find((e) => e.id === where?.id) || null;
      }),
    };

    mockEntityManager = {
      query: jest.fn(),
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === AppressoTransactionEntity || entity?.name === 'AppressoTransactionEntity') {
          return mockTxnRepo;
        }
        if (entity === AppressoAnomalyEpisodeEntity || entity?.name === 'AppressoAnomalyEpisodeEntity') {
          return mockEpisodeRepo;
        }
        return null;
      }),
    };

    service = new AppressoAnalyticsService(mockEntityManager);
  });

  describe('En modo in-memory (fallback local)', () => {
    it('calcula métricas de overview correctamente', async () => {
      const res = await service.getOverview({ from: '900000', to: '3000000' });

      expect(res.period.from).toBe(900000);
      expect(res.period.to).toBe(3000000);
      expect(res.transactions.total).toBe(3);
      expect(res.transactions.totalValue).toBe(55000);
      expect(res.transactions.averageValue).toBe(Math.round(55000 / 3));

      expect(res.episodes.total).toBe(2);
      expect(res.episodes.open).toBe(1);
      expect(res.episodes.closed).toBe(1);

      expect(res.fraud.flaggedTransactions).toBe(1);
      expect(res.fraud.suspiciousPercentage).toBe(Number(((1 / 3) * 100).toFixed(2)));
      expect(res.fraud.affectedUsers).toBe(1); // user-A
      expect(res.fraud.recurrentUsers).toBe(1); // user-A tiene 2 episodios
      expect(res.fraud.suspiciousTotalValue).toBe(15000);
      expect(res.fraud.averageSuspiciousValuePerUser).toBe(15000);
    });

    it('maneja rangos vacíos sin divisiones por cero ni errores NaN', async () => {
      const res = await service.getOverview({ from: '50000000', to: '60000000' });

      expect(res.transactions.total).toBe(0);
      expect(res.transactions.totalValue).toBe(0);
      expect(res.transactions.averageValue).toBe(0);
      expect(res.episodes.total).toBe(0);
      expect(res.fraud.suspiciousPercentage).toBe(0);
      expect(res.fraud.affectedUsers).toBe(0);
    });

    it('agrupa actividad en serie temporal por hora y por día', async () => {
      const resHour = await service.getTimeseries({
        from: '900000',
        to: '3000000',
        bucket: 'hour',
      });

      expect(resHour.period.bucket).toBe('hour');
      expect(resHour.data.length).toBeGreaterThan(0);
      const totalCount = resHour.data.reduce((sum, p) => sum + p.transactionCount, 0);
      expect(totalCount).toBe(3);

      const resDay = await service.getTimeseries({
        from: '900000',
        to: '3000000',
        bucket: 'day',
      });
      expect(resDay.period.bucket).toBe('day');
      expect(resDay.data.length).toBe(1);
      expect(resDay.data[0].transactionCount).toBe(3);
      expect(resDay.data[0].anomalyCount).toBe(1);
    });

    it('genera la línea de tiempo cronológica de un episodio', async () => {
      const res = await service.getEpisodeTimeline('ep-uuid-1');

      expect(res.episode.id).toBe('ep-uuid-1');
      expect(res.episode.status).toBe(EpisodeStatus.CLOSED);
      expect(res.events.length).toBeGreaterThanOrEqual(4);

      // Primer evento en la ventana: transacción previa
      expect(res.events[0].type).toBe('TRANSACTION_FLAGGED');
      expect(res.events[0].timestamp).toBe(1000000);

      // Evento de apertura
      const openEvent = res.events.find((e) => e.type === 'EPISODE_OPENED');
      expect(openEvent).toBeDefined();
      expect(openEvent?.timestamp).toBe(1001000);

      // Evento de cierre al final
      const lastEvent = res.events[res.events.length - 1];
      expect(lastEvent.type).toBe('EPISODE_CLOSED');
      expect(lastEvent.timestamp).toBe(1005000);
    });

    it('lanza NotFoundException cuando el episodio no existe', async () => {
      await expect(service.getEpisodeTimeline('inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('En modo PostgreSQL (Neon)', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host/db';
      service = new AppressoAnalyticsService(mockEntityManager);
    });

    afterEach(() => {
      delete process.env.DATABASE_URL;
    });

    it('ejecuta consultas agregadas en SQL para overview sin barrido en memoria', async () => {
      mockEntityManager.query
        .mockResolvedValueOnce([
          { total_txns: '10', total_value: '500000', flagged_txns: '2', suspicious_val: '100000' },
        ])
        .mockResolvedValueOnce([
          {
            total_episodes: '2',
            open_episodes: '1',
            closed_episodes: '1',
            reviewed_episodes: '0',
            dismissed_episodes: '0',
            affected_users: '1',
          },
        ])
        .mockResolvedValueOnce([{ recurrent_users: '1' }]);

      const res = await service.getOverview({ from: '1000', to: '2000' });

      expect(mockEntityManager.query).toHaveBeenCalledTimes(3);
      expect(res.transactions.total).toBe(10);
      expect(res.transactions.totalValue).toBe(500000);
      expect(res.fraud.flaggedTransactions).toBe(2);
      expect(res.fraud.suspiciousPercentage).toBe(20);
      expect(res.fraud.affectedUsers).toBe(1);
      expect(res.fraud.recurrentUsers).toBe(1);
    });

    it('ejecuta agregación SQL date_trunc para serie temporal', async () => {
      mockEntityManager.query.mockResolvedValueOnce([
        {
          bucket_date: '2026-09-23T10:00:00.000Z',
          bucket_ts: '1727085600000',
          txn_count: '5',
          total_val: '250000',
          anomaly_count: '1',
          flagged_val: '50000',
        },
      ]);

      const res = await service.getTimeseries({ bucket: 'hour' });

      expect(mockEntityManager.query).toHaveBeenCalledTimes(1);
      expect(res.data.length).toBe(1);
      expect(res.data[0].transactionCount).toBe(5);
      expect(res.data[0].anomalyCount).toBe(1);
    });
  });
});

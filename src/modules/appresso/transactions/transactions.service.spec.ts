import { UnauthorizedException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AppressoMetricsService, METRIC } from '../metrics/appresso-metrics.service';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';
import { computeHmac } from '../crypto/hmac';
import { TimeBandName } from '../fraud-detection/time-band-policy';

describe('TransactionsService (A3.1 - A3.5)', () => {
  const SECRET = 'test-appresso-secret';
  let service: TransactionsService;
  let metrics: AppressoMetricsService;
  let mockEntityManager: any;
  let mockTxnRepo: any;
  let mockEpisodeRepo: any;
  let storedEpisodes: Map<string, any>;

  beforeEach(() => {
    process.env.APPRESSO_HMAC_SECRET = SECRET;

    const storedTransactions = new Map<string, any>();
    storedEpisodes = new Map<string, any>();

    mockTxnRepo = {
      create: jest.fn().mockImplementation((entity: any) => ({ ...entity })),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        return storedTransactions.get(where.idTxn) || null;
      }),
      save: jest.fn().mockImplementation(async (entity: any) => {
        storedTransactions.set(entity.idTxn, { ...entity, id: entity.id || 'uuid-txn' });
        return storedTransactions.get(entity.idTxn);
      }),
    };

    mockEpisodeRepo = {
      create: jest.fn().mockImplementation((entity: any) => ({ ...entity })),
      findOne: jest.fn().mockImplementation(async ({ where }: any) => {
        for (const ep of storedEpisodes.values()) {
          if (ep.userId === where.userId && ep.status === where.status) return ep;
        }
        return null;
      }),
      save: jest.fn().mockImplementation(async (entity: any) => {
        storedEpisodes.set(entity.id || 'uuid-ep', entity);
        return entity;
      }),
    };

    mockEntityManager = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest.fn().mockImplementation(async (cb: any) => {
        return cb(mockEntityManager);
      }),
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity.name === 'AppressoTransactionEntity') return mockTxnRepo;
        if (entity.name === 'AppressoAnomalyEpisodeEntity') return mockEpisodeRepo;
        return null;
      }),
    };

    metrics = new AppressoMetricsService();
    service = new TransactionsService(mockEntityManager as any, metrics);
  });

  const createValidDto = (overrides?: Partial<CreateAppressoTransactionDto>): CreateAppressoTransactionDto => {
    const base: CreateAppressoTransactionDto = {
      idTxn: 'txn-101',
      user: 'client-1',
      value: 50000,
      currency: 'COP',
      paymentMethod: 'DEBIT_CARD',
      date: '2026-09-23T10:30:00.000Z',
      hash: '',
    };
    const dto = { ...base, ...overrides };
    dto.hash = computeHmac(dto, SECRET);
    return dto;
  };

  it('rechaza peticiones con HMAC inválido con UnauthorizedException', async () => {
    const dto = createValidDto();
    dto.hash = '0000000000000000000000000000000000000000000000000000000000000000';

    await expect(service.processTransaction(dto)).rejects.toThrow(UnauthorizedException);
    expect(metrics.snapshot().counters[METRIC.REJECTED_BY_HMAC]).toBe(1);
  });

  it('procesa una transacción legítima correctamente sin anomalía si count < 3', async () => {
    const dto = createValidDto({ idTxn: 'txn-first' });
    const result = await service.processTransaction(dto);

    expect(result.status).toBe('ACCEPTED');
    expect(result.idTxn).toBe('txn-first');
    expect(result.isDuplicate).toBe(false);
    expect(result.anomaly.detected).toBe(false);
    expect(result.anomaly.windowCount).toBe(1);
  });

  it('detecta anomalía POSIBLE_FRAUDE cuando llegan 3 transacciones en la ventana', async () => {
    const dto1 = createValidDto({ idTxn: 'txn-1' });
    const dto2 = createValidDto({ idTxn: 'txn-2' });
    const dto3 = createValidDto({ idTxn: 'txn-3' });

    await service.processTransaction(dto1);
    await service.processTransaction(dto2);
    const res3 = await service.processTransaction(dto3);

    expect(res3.status).toBe('ACCEPTED');
    expect(res3.anomaly.detected).toBe(true);
    expect(res3.anomaly.rule).toBe('POSIBLE_FRAUDE');
    expect(res3.anomaly.windowCount).toBe(3);
    expect(res3.anomaly.episodeId).toBeDefined();
  });

  it('maneja idempotencia retornando el resultado previo sin volver a contar en la ventana', async () => {
    const dto = createValidDto({ idTxn: 'txn-unique' });
    const firstRes = await service.processTransaction(dto);
    expect(firstRes.isDuplicate).toBe(false);

    // Reenvío idéntico
    const retryRes = await service.processTransaction(dto);
    expect(retryRes.status).toBe('ACCEPTED');
    expect(retryRes.idTxn).toBe('txn-unique');
    expect(retryRes.isDuplicate).toBe(true);
    expect(retryRes.anomaly.detected).toBe(firstRes.anomaly.detected);
  });

  describe('serialización por usuario bajo concurrencia (A3.5, C9.0 - C9.1)', () => {
    it('no pierde el cruce de umbral con 3 peticiones simultáneas del mismo usuario', async () => {
      const results = await Promise.all([
        service.processTransaction(createValidDto({ idTxn: 'conc-1' })),
        service.processTransaction(createValidDto({ idTxn: 'conc-2' })),
        service.processTransaction(createValidDto({ idTxn: 'conc-3' })),
      ]);

      // Exactamente una petición dispara la anomalía, con conteo 3. Si la serialización
      // fallara, dos o más podrían evaluarse sobre el mismo estado previo.
      const anomalies = results.filter((r) => r.anomaly.detected);
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].anomaly.windowCount).toBe(3);
      expect(anomalies[0].anomaly.rule).toBe('POSIBLE_FRAUDE');

      // Los tres conteos son 1, 2 y 3 sin repeticiones: ninguna transacción se contó dos veces.
      const counts = results.map((r) => r.anomaly.windowCount).sort((a, b) => a - b);
      expect(counts).toEqual([1, 2, 3]);

      // Un único episodio: el cruce no abre episodios duplicados.
      expect(storedEpisodes.size).toBe(1);
      const episode = Array.from(storedEpisodes.values())[0];
      expect(episode.transactionIds).toHaveLength(3);
      expect(episode.transactionCount).toBe(3);
    });

    it('actualiza el episodio OPEN en lugar de crear varios cuando el umbral se cruza dos veces', async () => {
      const results = await Promise.all([
        service.processTransaction(createValidDto({ idTxn: 'burst-1' })),
        service.processTransaction(createValidDto({ idTxn: 'burst-2' })),
        service.processTransaction(createValidDto({ idTxn: 'burst-3' })),
        service.processTransaction(createValidDto({ idTxn: 'burst-4' })),
      ]);

      const anomalies = results.filter((r) => r.anomaly.detected);
      expect(anomalies).toHaveLength(2);

      // Ambas detecciones apuntan al mismo episodio: el segundo cruce lo actualiza.
      const episodeIds = new Set(anomalies.map((r) => r.anomaly.episodeId));
      expect(episodeIds.size).toBe(1);
      expect(storedEpisodes.size).toBe(1);

      const episode = Array.from(storedEpisodes.values())[0];
      expect(episode.transactionIds).toHaveLength(4);
      expect(metrics.snapshot().counters[METRIC.ANOMALIES_CREATED]).toBe(1);
      expect(metrics.snapshot().counters[METRIC.ANOMALIES_UPDATED]).toBe(1);
    });

    it('un reintento concurrente con idTxn ya visto no vuelve a contar en la ventana', async () => {
      const first = createValidDto({ idTxn: 'retry-1' });
      await service.processTransaction(first);

      const [retry] = await Promise.all([
        service.processTransaction(first),
        service.processTransaction(createValidDto({ idTxn: 'retry-2' })),
        service.processTransaction(createValidDto({ idTxn: 'retry-3' })),
      ]);

      expect(retry.isDuplicate).toBe(true);
      expect(retry.anomaly.windowCount).toBe(0);
      expect(metrics.snapshot().counters[METRIC.DUPLICATES_HANDLED]).toBe(1);
    });

    it('aisla las ventanas entre usuarios distintos bajo concurrencia', async () => {
      const perUser = 2;
      const users = 4;

      const promises: Promise<any>[] = [];
      for (let u = 1; u <= users; u++) {
        for (let t = 1; t <= perUser; t++) {
          promises.push(
            service.processTransaction(
              createValidDto({ idTxn: `iso-u${u}-t${t}`, user: `user-${u}` }),
            ),
          );
        }
      }
      const results = await Promise.all(promises);

      // Ningún usuario alcanza 3 dentro de la ventana, así que no puede haber anomalía.
      expect(results.every((r) => r.anomaly.detected === false)).toBe(true);
      expect(storedEpisodes.size).toBe(0);
    });
  });

  describe('cierre de episodios vencidos en la ingesta (C6.0)', () => {
    it('abre un episodio nuevo cuando el anterior ya expiró, en lugar de reutilizarlo para siempre', async () => {
      const user = 'recurring-user';

      // Primera ráfaga: abre el episodio.
      await service.processTransaction(createValidDto({ idTxn: 'exp-1', user }));
      await service.processTransaction(createValidDto({ idTxn: 'exp-2', user }));
      const first = await service.processTransaction(createValidDto({ idTxn: 'exp-3', user }));
      expect(first.anomaly.detected).toBe(true);
      expect(storedEpisodes.size).toBe(1);

      // Se espera a que la ventana venza por completo.
      await new Promise((resolve) => setTimeout(resolve, 3200));

      // Segunda ráfaga: sin el cierre perezoso, el detector seguiría apuntando al episodio
      // original y todas las anomalías futuras se accumulateían en un único episodio.
      await service.processTransaction(createValidDto({ idTxn: 'exp-4', user }));
      await service.processTransaction(createValidDto({ idTxn: 'exp-5', user }));
      const second = await service.processTransaction(createValidDto({ idTxn: 'exp-6', user }));

      expect(second.anomaly.detected).toBe(true);
      expect(storedEpisodes.size).toBe(2);
      expect(second.anomaly.episodeId).not.toBe(first.anomaly.episodeId);
    });
  });

  describe('política de límites por franja horaria en UTC (W2)', () => {
    let dateSpy: jest.SpyInstance;

    afterEach(() => {
      if (dateSpy) dateSpy.mockRestore();
    });

    it('aplica umbral 10 en la mañana (05:00:01 - 12:00:00 UTC) y persiste franja en respuesta', async () => {
      // 09:00:00 UTC (mañana)
      dateSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 1, 9, 0, 0));

      const res = await service.processTransaction(createValidDto({ idTxn: 'm-1' }));
      expect(res.anomaly.timeBand).toBe(TimeBandName.MANANA);
      expect(res.anomaly.threshold).toBe(10);
      expect(res.anomaly.windowMs).toBe(3000);
      expect(res.anomaly.detected).toBe(false);
    });

    it('borde de franja: la franja de receivedAt del evento actual determina su umbral', async () => {
      const user = 'cross-band-user';

      // Evento 1 a las 11:59:59.000 UTC (MANANA, umbral 10)
      dateSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 1, 11, 59, 59, 0));
      await service.processTransaction(createValidDto({ idTxn: 'cb-1', user }));

      // Evento 2 a las 11:59:59.500 UTC (MANANA, umbral 10)
      dateSpy.mockReturnValue(Date.UTC(2026, 9, 1, 11, 59, 59, 500));
      await service.processTransaction(createValidDto({ idTxn: 'cb-2', user }));

      // Evento 3 a las 12:00:01.000 UTC (TARDE_NOCHE, umbral 6)
      // La ventana de 3000ms aún cubre cb-1 y cb-2 (están dentro de 12:00:01 - 3000 = 11:59:58).
      // El conteo es 3, pero como la franja actual es TARDE_NOCHE (umbral 6), no es anomalía.
      dateSpy.mockReturnValue(Date.UTC(2026, 9, 1, 12, 0, 1, 0));
      const res3 = await service.processTransaction(createValidDto({ idTxn: 'cb-3', user }));

      expect(res3.anomaly.timeBand).toBe(TimeBandName.TARDE_NOCHE);
      expect(res3.anomaly.threshold).toBe(6);
      expect(res3.anomaly.windowCount).toBe(3);
      expect(res3.anomaly.detected).toBe(false);
    });

    it('dispara anomalía en NOCHE_MADRUGADA (umbral 3) y persiste metadata para auditoría', async () => {
      const user = 'night-user';
      // 22:00:00 UTC (NOCHE_MADRUGADA, umbral 3)
      dateSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 1, 22, 0, 0, 0));

      await service.processTransaction(createValidDto({ idTxn: 'n-1', user }));
      await service.processTransaction(createValidDto({ idTxn: 'n-2', user }));
      const res3 = await service.processTransaction(createValidDto({ idTxn: 'n-3', user }));

      expect(res3.anomaly.timeBand).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(res3.anomaly.threshold).toBe(3);
      expect(res3.anomaly.detected).toBe(true);

      const savedEpisode = storedEpisodes.get(res3.anomaly.episodeId);
      expect(savedEpisode).toBeDefined();
      expect(savedEpisode.notes).toContain(TimeBandName.NOCHE_MADRUGADA);
    });

    it('reintento en franja posterior mantiene idempotencia y no recalcula en ventana', async () => {
      const user = 'retry-band-user';
      dateSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 9, 1, 10, 0, 0));
      const initial = await service.processTransaction(createValidDto({ idTxn: 'ret-1', user }));

      expect(initial.isDuplicate).toBe(false);

      // Reintento en otra hora
      dateSpy.mockReturnValue(Date.UTC(2026, 9, 1, 15, 0, 0));
      const retry = await service.processTransaction(createValidDto({ idTxn: 'ret-1', user }));

      expect(retry.isDuplicate).toBe(true);
      expect(retry.anomaly.windowCount).toBe(0);
      expect(retry.receivedAt).toBe(initial.receivedAt);
    });
  });
});
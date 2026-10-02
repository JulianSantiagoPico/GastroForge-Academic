import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';
import { computeHmac } from '../crypto/hmac';

describe('TransactionsService (A3.1 - A3.5)', () => {
  const SECRET = 'test-appresso-secret';
  let service: TransactionsService;
  let mockEntityManager: any;
  let mockTxnRepo: any;
  let mockEpisodeRepo: any;

  beforeEach(() => {
    process.env.APPRESSO_HMAC_SECRET = SECRET;

    const storedTransactions = new Map<string, any>();
    const storedEpisodes = new Map<string, any>();

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
      query: jest.fn().mockResolvedValue([]), // Advisory lock simulation
      transaction: jest.fn().mockImplementation(async (cb: any) => {
        return cb(mockEntityManager);
      }),
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity.name === 'AppressoTransactionEntity') return mockTxnRepo;
        if (entity.name === 'AppressoAnomalyEpisodeEntity') return mockEpisodeRepo;
        return null;
      }),
    };

    service = new TransactionsService(mockEntityManager as any);
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
});

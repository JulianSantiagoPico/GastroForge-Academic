import { Test, TestingModule } from '@nestjs/testing';
import { SimulationController } from './simulation.controller';
import { TransactionsService } from '../transactions/transactions.service';

describe('SimulationController', () => {
  let controller: SimulationController;
  let mockTransactionsService: any;

  beforeEach(async () => {
    process.env.APPRESSO_HMAC_SECRET = 'test-secret';
    mockTransactionsService = {
      processTransaction: jest.fn().mockImplementation(async (dto) => ({
        status: 'ACCEPTED',
        idTxn: dto.idTxn,
        receivedAt: Date.now(),
        isDuplicate: false,
        anomaly: {
          detected: dto.idTxn.endsWith('-3'),
          rule: dto.idTxn.endsWith('-3') ? 'POSIBLE_FRAUDE' : undefined,
          windowCount: parseInt(dto.idTxn.split('-').pop() || '1', 10),
          threshold: 3,
        },
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimulationController],
      providers: [
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    }).compile();

    controller = module.get<SimulationController>(SimulationController);
  });

  it('procesa una ráfaga simulada de transacciones firmadas internamente', async () => {
    const res = await controller.runBurst({
      user: 'test-sim-user',
      count: 3,
      delayMs: 0,
    });

    expect(res.summary.sent).toBe(3);
    expect(res.summary.accepted).toBe(3);
    expect(res.summary.anomalies).toBe(1);
    expect(res.summary.userId).toBe('test-sim-user');
    expect(res.results).toHaveLength(3);
    expect(mockTransactionsService.processTransaction).toHaveBeenCalledTimes(3);
  });

  it('asigna un usuario por defecto si no se especifica', async () => {
    const res = await controller.runBurst({ count: 2 });
    expect(res.summary.userId).toMatch(/^sim-user-/);
    expect(res.results).toHaveLength(2);
  });
});

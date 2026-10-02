import { Test, TestingModule } from '@nestjs/testing';
import { AppressoTransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';
import { computeHmac } from '../crypto/hmac';

describe('AppressoTransactionsController', () => {
  let controller: AppressoTransactionsController;
  let service: TransactionsService;
  const SECRET = 'test-secret';

  beforeEach(async () => {
    process.env.APPRESSO_HMAC_SECRET = SECRET;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppressoTransactionsController],
      providers: [
        {
          provide: TransactionsService,
          useValue: {
            processTransaction: jest.fn().mockImplementation(async (dto: CreateAppressoTransactionDto) => {
              return {
                status: 'ACCEPTED',
                idTxn: dto.idTxn,
                receivedAt: 1727087401120,
                isDuplicate: false,
                anomaly: {
                  detected: false,
                  windowCount: 1,
                  threshold: 3,
                },
              };
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AppressoTransactionsController>(AppressoTransactionsController);
    service = module.get<TransactionsService>(TransactionsService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('delega el procesamiento al TransactionsService', async () => {
    const dto: CreateAppressoTransactionDto = {
      idTxn: 'txn-ctrl-01',
      user: 'user-ctrl',
      value: 10000,
      currency: 'COP',
      paymentMethod: 'CREDIT_CARD',
      date: '2026-09-23T10:30:00.000Z',
      hash: '',
    };
    dto.hash = computeHmac(dto, SECRET);

    const result = await controller.createTransaction(dto);
    expect(result.status).toBe('ACCEPTED');
    expect(result.idTxn).toBe('txn-ctrl-01');
    expect(service.processTransaction).toHaveBeenCalledWith(dto);
  });
});

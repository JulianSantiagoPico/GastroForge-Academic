import { Test, TestingModule } from '@nestjs/testing';
import { AppressoTransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';
import { computeHmac } from '../crypto/hmac';
import { AppressoMetricsService } from '../metrics/appresso-metrics.service';
import { AppressoThrottlerGuard } from '../throttling/appresso-throttler.guard';
import { AppressoRejectOriginInterceptor } from '../throttling/appresso-reject-origin.interceptor';
import type { Response } from 'express';

describe('AppressoTransactionsController', () => {
  let controller: AppressoTransactionsController;
  let service: TransactionsService;
  let mockResponse: { status: jest.Mock };
  const SECRET = 'test-secret';

  beforeEach(async () => {
    process.env.APPRESSO_HMAC_SECRET = SECRET;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppressoTransactionsController],
      providers: [
        AppressoMetricsService,
        AppressoThrottlerGuard,
        AppressoRejectOriginInterceptor,
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
            getConfig: jest.fn().mockReturnValue({
              windowMs: 3000,
              windowSeconds: 3,
              activeThreshold: 3,
              currentBand: 'NOCHE_MADRUGADA',
            }),
            updateConfig: jest.fn().mockImplementation((dto) => ({
              windowMs: dto.windowSeconds ? dto.windowSeconds * 1000 : 3000,
              windowSeconds: dto.windowSeconds ?? 3,
              activeThreshold: 3,
              currentBand: 'NOCHE_MADRUGADA',
            })),
          },
        },
      ],
    }).compile();

    controller = module.get<AppressoTransactionsController>(AppressoTransactionsController);
    service = module.get<TransactionsService>(TransactionsService);

    // `passthrough: true` hace que Nest siga usando la serialización estándar, así que el
    // controlador solo necesita el método `status` para fijar el código de respuesta.
    mockResponse = { status: jest.fn().mockReturnThis() };
  });

  const buildDto = (idTxn: string): CreateAppressoTransactionDto => {
    const dto: CreateAppressoTransactionDto = {
      idTxn,
      user: 'user-ctrl',
      value: 10000,
      currency: 'COP',
      paymentMethod: 'CREDIT_CARD',
      date: '2026-09-23T10:30:00.000Z',
      hash: '',
    };
    dto.hash = computeHmac(dto, SECRET);
    return dto;
  };

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('delega el procesamiento al TransactionsService', async () => {
    const dto = buildDto('txn-ctrl-01');

    const result = await controller.createTransaction(dto, mockResponse as unknown as Response);

    expect(result.status).toBe('ACCEPTED');
    expect(result.idTxn).toBe('txn-ctrl-01');
    expect(service.processTransaction).toHaveBeenCalledWith(dto);
  });

  it('responde 201 Created cuando la transacción es nueva', async () => {
    await controller.createTransaction(buildDto('txn-new'), mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(201);
  });

  it('responde 200 OK cuando el idTxn ya existía y se devuelve el resultado persistido', async () => {
    (service.processTransaction as jest.Mock).mockResolvedValueOnce({
      status: 'ACCEPTED',
      idTxn: 'txn-ctrl-01',
      receivedAt: 1727087401120,
      isDuplicate: true,
      anomaly: { detected: false, windowCount: 0, threshold: 3 },
    });

    await controller.createTransaction(buildDto('txn-ctrl-01'), mockResponse as unknown as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
  });

  it('permite consultar la configuración activa de la ventana con getConfig()', () => {
    const config = controller.getConfig();
    expect(config.windowSeconds).toBe(3);
    expect(config.activeThreshold).toBe(3);
    expect(service.getConfig).toHaveBeenCalled();
  });

  it('permite actualizar la ventana temporal dinámicamente con updateConfig()', () => {
    const updated = controller.updateConfig({ windowSeconds: 5 });
    expect(updated.windowSeconds).toBe(5);
    expect(service.updateConfig).toHaveBeenCalledWith({ windowSeconds: 5 });
  });
});
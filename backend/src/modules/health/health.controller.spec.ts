import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  it('retorna estado ok cuando los servicios están saludables', async () => {
    const mockEntityManager = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as any;
    const mockRedisAdapter = {
      isAvailable: jest.fn().mockReturnValue(true),
    } as any;

    controller = new HealthController(mockEntityManager, mockRedisAdapter);
    const result = await controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.services.postgres).toBe('up');
    expect(result.services.redis).toBe('up');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('retorna estado degraded pero sin error HTTP cuando solo Redis está degradado', async () => {
    const mockEntityManager = {
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as any;
    const mockRedisAdapter = {
      isAvailable: jest.fn().mockReturnValue(false),
    } as any;

    controller = new HealthController(mockEntityManager, mockRedisAdapter);
    const result = await controller.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.services.postgres).toBe('up');
    expect(result.services.redis).toBe('degraded');
  });

  it('lanza ServiceUnavailableException si la base de datos está caída', async () => {
    const mockEntityManager = {
      query: jest.fn().mockRejectedValue(new Error('Connection lost')),
    } as any;

    controller = new HealthController(mockEntityManager);
    await expect(controller.getHealth()).rejects.toThrow(ServiceUnavailableException);
  });
});

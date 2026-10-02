import { RedisSlidingWindowAdapter } from './redis-sliding-window.adapter';
import { AppressoMetricsService, METRIC } from '../metrics/appresso-metrics.service';

describe('RedisSlidingWindowAdapter (W3)', () => {
  let metrics: AppressoMetricsService;
  let mockRedisClient: any;

  beforeEach(() => {
    metrics = new AppressoMetricsService();
  });

  describe('Cuando REDIS_URL no está configurado (modo local / fallback)', () => {
    it('retorna null sin lanzar excepciones y registra degradación', async () => {
      const adapter = new RedisSlidingWindowAdapter(metrics, { redisUrl: undefined });

      expect(adapter.isAvailable()).toBe(false);
      const res = await adapter.recordAndCount('user-1', { idTxn: 't-1', receivedAt: 1000 }, 3000);

      expect(res).toBeNull();
      expect(metrics.snapshot().counters[METRIC.REDIS_DEGRADED]).toBe(1);
    });
  });

  describe('Con cliente Redis simulado', () => {
    let adapter: RedisSlidingWindowAdapter;

    beforeEach(() => {
      mockRedisClient = {
        eval: jest.fn().mockResolvedValue(3),
        pipeline: jest.fn().mockReturnValue({
          del: jest.fn().mockReturnThis(),
          zadd: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        }),
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue(undefined),
      };

      adapter = new RedisSlidingWindowAdapter(metrics, {
        client: mockRedisClient,
        failureThreshold: 2,
        cooldownMs: 100,
      });
    });

    afterEach(async () => {
      await adapter.onModuleDestroy();
    });

    it('ejecuta el script Lua atómico y retorna el conteo correcto', async () => {
      const res = await adapter.recordAndCount('user-1', { idTxn: 't-1', receivedAt: 1000 }, 3000);

      expect(res).toEqual({
        count: 3,
        source: 'redis',
        isDegraded: false,
      });
      expect(mockRedisClient.eval).toHaveBeenCalledTimes(1);
      expect(metrics.snapshot().counters[METRIC.REDIS_OPERATIONS]).toBe(1);
    });

    it('abre el Circuit Breaker tras alcanzar el umbral de fallos consecutivos', async () => {
      mockRedisClient.eval.mockRejectedValue(new Error('Connection timeout'));

      // Fallo 1
      const res1 = await adapter.recordAndCount('user-1', { idTxn: 't-1', receivedAt: 1000 }, 3000);
      expect(res1).toBeNull();
      expect(adapter.getCircuitState()).toBe('CLOSED');

      // Fallo 2 (alcanza failureThreshold: 2)
      const res2 = await adapter.recordAndCount('user-1', { idTxn: 't-2', receivedAt: 1001 }, 3000);
      expect(res2).toBeNull();
      expect(adapter.getCircuitState()).toBe('OPEN');
      expect(metrics.snapshot().counters[METRIC.REDIS_CIRCUIT_OPEN]).toBe(1);

      // Petición 3 mientras está OPEN: fail-fast sin llamar a eval
      const res3 = await adapter.recordAndCount('user-1', { idTxn: 't-3', receivedAt: 1002 }, 3000);
      expect(res3).toBeNull();
      expect(mockRedisClient.eval).toHaveBeenCalledTimes(2); // no se ejecutó la 3ra
    });

    it('recupera el Circuit Breaker pasando por HALF_OPEN tras cooldown', async () => {
      mockRedisClient.eval.mockRejectedValue(new Error('Connection timeout'));

      await adapter.recordAndCount('user-1', { idTxn: 't-1', receivedAt: 1000 }, 3000);
      await adapter.recordAndCount('user-1', { idTxn: 't-2', receivedAt: 1001 }, 3000);
      expect(adapter.getCircuitState()).toBe('OPEN');

      // Esperar tiempo de cooldown (100ms)
      await new Promise((resolve) => setTimeout(resolve, 110));

      expect(adapter.isAvailable()).toBe(true);
      expect(adapter.getCircuitState()).toBe('HALF_OPEN');

      // Prueba exitosa restablece a CLOSED
      mockRedisClient.eval.mockResolvedValue(1);
      const resProbe = await adapter.recordAndCount('user-1', { idTxn: 't-probe', receivedAt: 2000 }, 3000);

      expect(resProbe?.count).toBe(1);
      expect(adapter.getCircuitState()).toBe('CLOSED');
    });

    it('reconstruye la ventana acotada únicamente con eventos activos', async () => {
      const activeEvents = [
        { idTxn: 't-10', receivedAt: 5000 },
        { idTxn: 't-11', receivedAt: 5100 },
      ];

      const success = await adapter.reconstructActiveWindow('user-rebuild', activeEvents, 3000);

      expect(success).toBe(true);
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(metrics.snapshot().counters[METRIC.REDIS_RECONSTRUCTIONS]).toBe(1);
    });
  });
});

import {
  SlidingWindowDetector,
  WindowEvent,
  WindowEvaluationResult,
} from './sliding-window';

describe('SlidingWindowDetector (A2.1 - A2.4)', () => {
  const DEFAULT_WINDOW_MS = 3000;
  const DEFAULT_THRESHOLD = 3;

  let detector: SlidingWindowDetector;

  beforeEach(() => {
    detector = new SlidingWindowDetector({
      windowMs: DEFAULT_WINDOW_MS,
      threshold: DEFAULT_THRESHOLD,
    });
  });

  describe('Casos de borde temporales obligatorios (now - W)', () => {
    it('debe INCLUIR el evento que ocurre exactamente en now - W (borde inclusivo)', () => {
      const now = 10000;
      const borderEventTime = now - DEFAULT_WINDOW_MS; // 7000

      // Primer evento en now - W
      detector.processEvent({
        idTxn: 'txn-1',
        userId: 'user-1',
        receivedAt: borderEventTime,
      });

      // Segundo evento en now - W + 1000 (8000)
      detector.processEvent({
        idTxn: 'txn-2',
        userId: 'user-1',
        receivedAt: borderEventTime + 1000,
      });

      // Tercer evento en now (10000)
      const result = detector.processEvent({
        idTxn: 'txn-3',
        userId: 'user-1',
        receivedAt: now,
      });

      // Como 7000 >= 10000 - 3000, debe estar incluido: total 3 eventos => POSIBLE_FRAUDE
      expect(result.count).toBe(3);
      expect(result.isAnomaly).toBe(true);
      expect(result.windowEvents.map((e) => e.idTxn)).toEqual(['txn-1', 'txn-2', 'txn-3']);
    });

    it('debe EXCLUIR el evento que ocurre en now - W - 1 ms', () => {
      const now = 10000;
      const expiredEventTime = now - DEFAULT_WINDOW_MS - 1; // 6999

      // Evento vencido por 1 ms
      detector.processEvent({
        idTxn: 'txn-expired',
        userId: 'user-1',
        receivedAt: expiredEventTime,
      });

      // Evento en 8000
      detector.processEvent({
        idTxn: 'txn-2',
        userId: 'user-1',
        receivedAt: 8000,
      });

      // Evento en now (10000)
      const result = detector.processEvent({
        idTxn: 'txn-3',
        userId: 'user-1',
        receivedAt: now,
      });

      // El evento en 6999 fue purgado de la ventana
      expect(result.count).toBe(2);
      expect(result.isAnomaly).toBe(false);
      expect(result.windowEvents.map((e) => e.idTxn)).toEqual(['txn-2', 'txn-3']);
    });
  });

  describe('Detección de umbral y anomalía', () => {
    it('no marca anomalía con menos de 3 transacciones en la ventana', () => {
      const res1 = detector.processEvent({
        idTxn: 'txn-1',
        userId: 'user-1',
        receivedAt: 1000,
      });
      expect(res1.count).toBe(1);
      expect(res1.isAnomaly).toBe(false);

      const res2 = detector.processEvent({
        idTxn: 'txn-2',
        userId: 'user-1',
        receivedAt: 2000,
      });
      expect(res2.count).toBe(2);
      expect(res2.isAnomaly).toBe(false);
    });

    it('marca POSIBLE_FRAUDE cuando count >= threshold (3) en la ventana', () => {
      detector.processEvent({ idTxn: 'txn-1', userId: 'user-1', receivedAt: 1000 });
      detector.processEvent({ idTxn: 'txn-2', userId: 'user-1', receivedAt: 1500 });
      const res3 = detector.processEvent({
        idTxn: 'txn-3',
        userId: 'user-1',
        receivedAt: 2500,
      });

      expect(res3.count).toBe(3);
      expect(res3.isAnomaly).toBe(true);
      expect(res3.rule).toBe('POSIBLE_FRAUDE');
    });

    it('continúa marcando anomalía si llegan más transacciones mientras siga sobre el umbral', () => {
      detector.processEvent({ idTxn: 'txn-1', userId: 'user-1', receivedAt: 1000 });
      detector.processEvent({ idTxn: 'txn-2', userId: 'user-1', receivedAt: 1500 });
      detector.processEvent({ idTxn: 'txn-3', userId: 'user-1', receivedAt: 2000 });
      const res4 = detector.processEvent({
        idTxn: 'txn-4',
        userId: 'user-1',
        receivedAt: 2500,
      });

      expect(res4.count).toBe(4);
      expect(res4.isAnomaly).toBe(true);
    });
  });

  describe('Aislamiento por usuario', () => {
    it('mantiene ventanas estrictamente separadas por userId', () => {
      detector.processEvent({ idTxn: 'txn-u1-1', userId: 'user-1', receivedAt: 1000 });
      detector.processEvent({ idTxn: 'txn-u1-2', userId: 'user-1', receivedAt: 1200 });

      detector.processEvent({ idTxn: 'txn-u2-1', userId: 'user-2', receivedAt: 1300 });
      detector.processEvent({ idTxn: 'txn-u2-2', userId: 'user-2', receivedAt: 1400 });

      // Ninguno superó el umbral
      expect(detector.getWindowCount('user-1', 1500)).toBe(2);
      expect(detector.getWindowCount('user-2', 1500)).toBe(2);

      // user-1 agrega su 3ra transacción -> alerta solo user-1
      const resU1 = detector.processEvent({
        idTxn: 'txn-u1-3',
        userId: 'user-1',
        receivedAt: 1500,
      });
      expect(resU1.count).toBe(3);
      expect(resU1.isAnomaly).toBe(true);

      // user-2 sigue con 2 transacciones sin anomalía
      expect(detector.getWindowCount('user-2', 1500)).toBe(2);
    });
  });

  describe('Mismo milisegundo y eventos concurrentes', () => {
    it('maneja múltiples eventos con exactamente el mismo receivedAt', () => {
      const timestamp = 5000;
      detector.processEvent({ idTxn: 'txn-1', userId: 'user-1', receivedAt: timestamp });
      detector.processEvent({ idTxn: 'txn-2', userId: 'user-1', receivedAt: timestamp });
      const res3 = detector.processEvent({
        idTxn: 'txn-3',
        userId: 'user-1',
        receivedAt: timestamp,
      });

      expect(res3.count).toBe(3);
      expect(res3.isAnomaly).toBe(true);
    });
  });

  describe('Idempotencia y reintentos (idTxn)', () => {
    it('ignora reintentos con idTxn duplicado y no incrementa el contador de la ventana', () => {
      detector.processEvent({ idTxn: 'txn-1', userId: 'user-1', receivedAt: 1000 });
      detector.processEvent({ idTxn: 'txn-2', userId: 'user-1', receivedAt: 1500 });

      // Reintento de txn-2 con el mismo idTxn
      const retryResult = detector.processEvent({
        idTxn: 'txn-2',
        userId: 'user-1',
        receivedAt: 1500,
      });

      expect(retryResult.isDuplicate).toBe(true);
      expect(retryResult.count).toBe(2);
      expect(retryResult.isAnomaly).toBe(false);

      // Ahora enviamos txn-3 nueva
      const res3 = detector.processEvent({
        idTxn: 'txn-3',
        userId: 'user-1',
        receivedAt: 2000,
      });
      expect(res3.count).toBe(3);
      expect(res3.isAnomaly).toBe(true);
    });
  });

  describe('Rechazo de eventos fuera de orden', () => {
    it('rechaza un evento con receivedAt menor al último recibido para ese usuario', () => {
      detector.processEvent({ idTxn: 'txn-1', userId: 'user-1', receivedAt: 5000 });

      expect(() => {
        detector.processEvent({
          idTxn: 'txn-past',
          userId: 'user-1',
          receivedAt: 4999, // Menor que 5000
        });
      }).toThrow(/fuera de orden/i);
    });
  });

  describe('Purga y complejidad amortizada O(1)', () => {
    it('purga eventos viejos conforme avanza el tiempo', () => {
      detector.processEvent({ idTxn: 'txn-1', userId: 'user-1', receivedAt: 1000 });
      detector.processEvent({ idTxn: 'txn-2', userId: 'user-1', receivedAt: 2000 });
      detector.processEvent({ idTxn: 'txn-3', userId: 'user-1', receivedAt: 3000 });

      // En t = 4001, txn-1 (1000) ya venció (4001 - 3000 = 1001 > 1000)
      const res4 = detector.processEvent({
        idTxn: 'txn-4',
        userId: 'user-1',
        receivedAt: 4001,
      });

      expect(res4.count).toBe(3); // txn-2 (2000), txn-3 (3000), txn-4 (4001)
      expect(res4.windowEvents.map((e) => e.idTxn)).toEqual(['txn-2', 'txn-3', 'txn-4']);
    });
  });
});

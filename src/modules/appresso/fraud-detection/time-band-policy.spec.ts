import {
  TimeBandPolicy,
  TimeBandName,
  TimeBandEvaluation,
} from './time-band-policy';

describe('TimeBandPolicy (W2 - Límites por franja horaria en UTC)', () => {
  let policy: TimeBandPolicy;

  beforeEach(() => {
    policy = new TimeBandPolicy();
  });

  // Helper to create timestamp for a specific UTC time on an arbitrary date (2026-10-01)
  function createUtcTimestamp(hours: number, minutes: number, seconds: number, ms: number = 0): number {
    return Date.UTC(2026, 9, 1, hours, minutes, seconds, ms);
  }

  describe('Evaluación de franjas y umbrales en UTC', () => {
    it('clasifica mañana (05:00:01 - 12:00:00 UTC) con umbral 10', () => {
      const midMorning = createUtcTimestamp(9, 30, 0);
      const evalResult = policy.evaluate(midMorning);

      expect(evalResult.band).toBe(TimeBandName.MANANA);
      expect(evalResult.threshold).toBe(10);
      expect(evalResult.windowMs).toBe(3000);
    });

    it('clasifica tarde-noche (12:00:01 - 20:00:00 UTC) con umbral 6', () => {
      const midAfternoon = createUtcTimestamp(16, 45, 0);
      const evalResult = policy.evaluate(midAfternoon);

      expect(evalResult.band).toBe(TimeBandName.TARDE_NOCHE);
      expect(evalResult.threshold).toBe(6);
      expect(evalResult.windowMs).toBe(3000);
    });

    it('clasifica noche-madrugada (20:00:01 - 05:00:00 UTC) con umbral 3', () => {
      const night = createUtcTimestamp(22, 15, 0);
      const dawn = createUtcTimestamp(2, 30, 0);

      const evalNight = policy.evaluate(night);
      const evalDawn = policy.evaluate(dawn);

      expect(evalNight.band).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(evalNight.threshold).toBe(3);

      expect(evalDawn.band).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(evalDawn.threshold).toBe(3);
    });
  });

  describe('Fronteras exactas de segundo y milisegundo', () => {
    it('05:00:00.000 UTC pertenece a NOCHE_MADRUGADA (umbral 3)', () => {
      const ts = createUtcTimestamp(5, 0, 0, 0);
      const res = policy.evaluate(ts);
      expect(res.band).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(res.threshold).toBe(3);
    });

    it('05:00:00.001 UTC y 05:00:01.000 UTC pertenecen a MANANA (umbral 10)', () => {
      const tsMs = createUtcTimestamp(5, 0, 0, 1);
      const tsSec = createUtcTimestamp(5, 0, 1, 0);

      expect(policy.evaluate(tsMs).band).toBe(TimeBandName.MANANA);
      expect(policy.evaluate(tsMs).threshold).toBe(10);

      expect(policy.evaluate(tsSec).band).toBe(TimeBandName.MANANA);
      expect(policy.evaluate(tsSec).threshold).toBe(10);
    });

    it('12:00:00.000 UTC pertenece a MANANA (umbral 10)', () => {
      const ts = createUtcTimestamp(12, 0, 0, 0);
      const res = policy.evaluate(ts);
      expect(res.band).toBe(TimeBandName.MANANA);
      expect(res.threshold).toBe(10);
    });

    it('12:00:00.001 UTC y 12:00:01.000 UTC pertenecen a TARDE_NOCHE (umbral 6)', () => {
      const tsMs = createUtcTimestamp(12, 0, 0, 1);
      const tsSec = createUtcTimestamp(12, 0, 1, 0);

      expect(policy.evaluate(tsMs).band).toBe(TimeBandName.TARDE_NOCHE);
      expect(policy.evaluate(tsMs).threshold).toBe(6);

      expect(policy.evaluate(tsSec).band).toBe(TimeBandName.TARDE_NOCHE);
      expect(policy.evaluate(tsSec).threshold).toBe(6);
    });

    it('20:00:00.000 UTC pertenece a TARDE_NOCHE (umbral 6)', () => {
      const ts = createUtcTimestamp(20, 0, 0, 0);
      const res = policy.evaluate(ts);
      expect(res.band).toBe(TimeBandName.TARDE_NOCHE);
      expect(res.threshold).toBe(6);
    });

    it('20:00:00.001 UTC y 20:00:01.000 UTC pertenecen a NOCHE_MADRUGADA (umbral 3)', () => {
      const tsMs = createUtcTimestamp(20, 0, 0, 1);
      const tsSec = createUtcTimestamp(20, 0, 1, 0);

      expect(policy.evaluate(tsMs).band).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(policy.evaluate(tsMs).threshold).toBe(3);

      expect(policy.evaluate(tsSec).band).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(policy.evaluate(tsSec).threshold).toBe(3);
    });

    it('Medianoche (00:00:00.000 UTC) y fin del día (23:59:59.999 UTC) pertenecen a NOCHE_MADRUGADA (umbral 3)', () => {
      const midnight = createUtcTimestamp(0, 0, 0, 0);
      const endOfDay = createUtcTimestamp(23, 59, 59, 999);

      expect(policy.evaluate(midnight).band).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(policy.evaluate(midnight).threshold).toBe(3);

      expect(policy.evaluate(endOfDay).band).toBe(TimeBandName.NOCHE_MADRUGADA);
      expect(policy.evaluate(endOfDay).threshold).toBe(3);
    });
  });

  describe('Configuración personalizada y validaciones', () => {
    it('permite sobrescribir umbrales y windowMs mediante opciones válidas', () => {
      const customPolicy = new TimeBandPolicy({
        windowMs: 5000,
        thresholds: {
          [TimeBandName.MANANA]: 15,
          [TimeBandName.TARDE_NOCHE]: 8,
          [TimeBandName.NOCHE_MADRUGADA]: 4,
        },
      });

      const res = customPolicy.evaluate(createUtcTimestamp(8, 0, 0));
      expect(res.threshold).toBe(15);
      expect(res.windowMs).toBe(5000);
    });

    it('rechaza umbrales que no sean enteros positivos mayores a cero', () => {
      expect(() => {
        new TimeBandPolicy({
          thresholds: {
            [TimeBandName.MANANA]: 0,
            [TimeBandName.TARDE_NOCHE]: 6,
            [TimeBandName.NOCHE_MADRUGADA]: 3,
          },
        });
      }).toThrow(/debe ser un entero positivo/);

      expect(() => {
        new TimeBandPolicy({
          thresholds: {
            [TimeBandName.MANANA]: 10.5,
            [TimeBandName.TARDE_NOCHE]: 6,
            [TimeBandName.NOCHE_MADRUGADA]: 3,
          },
        });
      }).toThrow(/debe ser un entero positivo/);
    });
  });
});

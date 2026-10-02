import { Injectable, Optional } from '@nestjs/common';
import { APPRESSO_WINDOW_MS, resolveAppressoWindowMs } from '../appresso.constants';

export enum TimeBandName {
  MANANA = 'MANANA',
  TARDE_NOCHE = 'TARDE_NOCHE',
  NOCHE_MADRUGADA = 'NOCHE_MADRUGADA',
}

export interface TimeBandEvaluation {
  band: TimeBandName;
  threshold: number;
  windowMs: number;
  receivedAt: number;
}

export interface TimeBandPolicyConfig {
  windowMs?: number;
  thresholds?: Partial<Record<TimeBandName, number>>;
}

/**
 * Política pura de límites por franja horaria en UTC (W2).
 *
 * Franjas definidas por el contrato:
 * - Mañana (05:00:01 – 12:00:00 UTC): umbral 10
 * - Tarde-noche (12:00:01 – 20:00:00 UTC): umbral 6
 * - Noche-madrugada (20:00:01 – 05:00:00 UTC): umbral 3
 *
 * La política es pura y determinista: recibe `receivedAt` (milisegundos epoch) y
 * extrae la hora, minuto, segundo y milisegundo en UTC.
 */
@Injectable()
export class TimeBandPolicy {
  private windowMs: number;
  private thresholds: Record<TimeBandName, number>;

  // Puntos de corte en milisegundos desde las 00:00:00.000 UTC
  // 05:00:00.000 = 5 * 3600 * 1000 = 18_000_000
  // 12:00:00.000 = 12 * 3600 * 1000 = 43_200_000
  // 20:00:00.000 = 20 * 3600 * 1000 = 72_000_000
  private static readonly FIVE_HOURS_MS = 18_000_000;
  private static readonly TWELVE_HOURS_MS = 43_200_000;
  private static readonly TWENTY_HOURS_MS = 72_000_000;

  constructor(@Optional() config?: TimeBandPolicyConfig) {
    this.windowMs = config?.windowMs ?? resolveAppressoWindowMs();

    const morning =
      config?.thresholds?.[TimeBandName.MANANA] ??
      (process.env.APPRESSO_BAND_MORNING_THRESHOLD
        ? parseInt(process.env.APPRESSO_BAND_MORNING_THRESHOLD, 10)
        : 10);

    const afternoon =
      config?.thresholds?.[TimeBandName.TARDE_NOCHE] ??
      (process.env.APPRESSO_BAND_AFTERNOON_THRESHOLD
        ? parseInt(process.env.APPRESSO_BAND_AFTERNOON_THRESHOLD, 10)
        : 6);

    const night =
      config?.thresholds?.[TimeBandName.NOCHE_MADRUGADA] ??
      (process.env.APPRESSO_BAND_NIGHT_THRESHOLD
        ? parseInt(process.env.APPRESSO_BAND_NIGHT_THRESHOLD, 10)
        : 3);

    this.validateThreshold(TimeBandName.MANANA, morning);
    this.validateThreshold(TimeBandName.TARDE_NOCHE, afternoon);
    this.validateThreshold(TimeBandName.NOCHE_MADRUGADA, night);

    this.thresholds = {
      [TimeBandName.MANANA]: morning,
      [TimeBandName.TARDE_NOCHE]: afternoon,
      [TimeBandName.NOCHE_MADRUGADA]: night,
    };
  }

  private validateThreshold(name: string, value: number): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `El umbral para la franja ${name} debe ser un entero positivo mayor a cero (recibido: ${value})`,
      );
    }
  }

  /**
   * Evalúa un instante recibido en epoch ms y retorna la franja, umbral y ventana aplicable en UTC.
   */
  evaluate(receivedAt: number): TimeBandEvaluation {
    const d = new Date(receivedAt);
    const msOfDay =
      d.getUTCHours() * 3600_000 +
      d.getUTCMinutes() * 60_000 +
      d.getUTCSeconds() * 1000 +
      d.getUTCMilliseconds();

    let band: TimeBandName;
    if (
      msOfDay > TimeBandPolicy.FIVE_HOURS_MS &&
      msOfDay <= TimeBandPolicy.TWELVE_HOURS_MS
    ) {
      band = TimeBandName.MANANA;
    } else if (
      msOfDay > TimeBandPolicy.TWELVE_HOURS_MS &&
      msOfDay <= TimeBandPolicy.TWENTY_HOURS_MS
    ) {
      band = TimeBandName.TARDE_NOCHE;
    } else {
      band = TimeBandName.NOCHE_MADRUGADA;
    }

    return {
      band,
      threshold: this.thresholds[band],
      windowMs: this.windowMs,
      receivedAt,
    };
  }

  /** Retorna el ancho actual de la ventana en milisegundos. */
  getWindowMs(): number {
    return this.windowMs;
  }

  /** Modifica dinámicamente el ancho de la ventana en milisegundos. */
  setWindowMs(ms: number): void {
    if (!Number.isInteger(ms) || ms <= 0) {
      throw new Error(`El ancho de ventana debe ser un entero positivo en milisegundos (recibido: ${ms})`);
    }
    this.windowMs = ms;
  }

  /** Retorna una copia de los umbrales configurados por franja horaria. */
  getThresholds(): Record<TimeBandName, number> {
    return { ...this.thresholds };
  }

  /** Modifica el umbral para una franja específica. */
  setThreshold(band: TimeBandName, threshold: number): void {
    this.validateThreshold(band, threshold);
    this.thresholds[band] = threshold;
  }
}

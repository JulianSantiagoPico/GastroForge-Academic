import {
  validateDatabaseEnvironment,
  resolveDatabaseUrl,
  dataSourceOptions,
} from './data-source';
import { AppressoTransactionEntity } from '../modules/appresso/persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from '../modules/appresso/persistence/entities/anomaly-episode.entity';

describe('DataSource Configuration & Neon Operations (W1)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateDatabaseEnvironment', () => {
    it('falla de forma visible y explícita si NODE_ENV es production y DATABASE_URL no está definido', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;

      expect(() => validateDatabaseEnvironment()).toThrow(
        /FATAL: DATABASE_URL is required in production environment/,
      );
    });

    it('no falla si NODE_ENV es production y DATABASE_URL está presente', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://user:pass@neon.tech/db?sslmode=require';

      expect(() => validateDatabaseEnvironment()).not.toThrow();
    });

    it('permite fallback in-memory en desarrollo o test si DATABASE_URL no está definido', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.DATABASE_URL;

      expect(() => validateDatabaseEnvironment()).not.toThrow();
    });
  });

  describe('resolveDatabaseUrl', () => {
    it('prioriza DATABASE_URL_DIRECT si isMigrationCli es true', () => {
      process.env.DATABASE_URL = 'postgresql://pooled.neon.tech/db';
      process.env.DATABASE_URL_DIRECT = 'postgresql://direct.neon.tech/db';

      expect(resolveDatabaseUrl(true)).toBe('postgresql://direct.neon.tech/db');
    });

    it('usa DATABASE_URL normal para el proceso web runtime aunque exista DIRECT', () => {
      process.env.DATABASE_URL = 'postgresql://pooled.neon.tech/db';
      process.env.DATABASE_URL_DIRECT = 'postgresql://direct.neon.tech/db';

      expect(resolveDatabaseUrl(false)).toBe('postgresql://pooled.neon.tech/db');
    });
  });

  describe('dataSourceOptions', () => {
    it('mantiene synchronize estrictamente desactivado (false) para evitar alteración no controlada del esquema', () => {
      expect(dataSourceOptions.synchronize).toBe(false);
    });

    it('incluye las entidades requeridas de Appresso', () => {
      expect(dataSourceOptions.entities).toContain(AppressoTransactionEntity);
      expect(dataSourceOptions.entities).toContain(AppressoAnomalyEpisodeEntity);
    });
  });
});

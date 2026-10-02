import { DataSource, DataSourceOptions } from 'typeorm';
import { AppressoTransactionEntity } from '../modules/appresso/persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from '../modules/appresso/persistence/entities/anomaly-episode.entity';

/**
 * Validates database environment configuration.
 * In production, DATABASE_URL must be defined; falling back to in-memory mode is strictly prohibited.
 */
export function validateDatabaseEnvironment(): void {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    throw new Error(
      'FATAL: DATABASE_URL is required in production environment. In-memory fallback is strictly disabled in production.',
    );
  }
}

/**
 * Resolve the connection URL for TypeORM:
 * - Direct URL (DATABASE_URL_DIRECT) is preferred for migration operations if provided (e.g. Neon direct vs pooled).
 * - Standard application URL (DATABASE_URL) is used for runtime.
 */
export function resolveDatabaseUrl(isMigrationCli = false): string | undefined {
  if (isMigrationCli && process.env.DATABASE_URL_DIRECT) {
    return process.env.DATABASE_URL_DIRECT;
  }
  return process.env.DATABASE_URL;
}

const isCli = process.env.TYPEORM_CLI === 'true' || require.main?.filename?.includes('typeorm');
const dbUrl = resolveDatabaseUrl(isCli) || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gastroforge_dev';

const isSslEnabled =
  dbUrl.includes('sslmode=require') ||
  process.env.DB_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && !dbUrl.includes('localhost'));

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: dbUrl,
  entities: [AppressoTransactionEntity, AppressoAnomalyEpisodeEntity],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false, // Strict requirement: schema changes must be applied via migrations
  ssl: isSslEnabled ? { rejectUnauthorized: false } : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;

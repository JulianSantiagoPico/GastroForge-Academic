import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration W4: Add indexes to support analytical read model queries in PostgreSQL (Neon).
 * Speeds up overview, timeseries and episode timeline queries.
 */
export class AddAnalyticsIndexes1727800000001 implements MigrationInterface {
  name = 'AddAnalyticsIndexes1727800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_transactions_anomalyEpisodeId" 
      ON "appresso_transactions" ("anomalyEpisodeId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_anomaly_episodes_openedAt" 
      ON "appresso_anomaly_episodes" ("openedAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_anomaly_episodes_status" 
      ON "appresso_anomaly_episodes" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appresso_anomaly_episodes_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appresso_anomaly_episodes_openedAt";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appresso_transactions_anomalyEpisodeId";`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial migration establishing the schema for Appresso on PostgreSQL (Neon).
 * Generates appresso_transactions and appresso_anomaly_episodes with matching indexes.
 */
export class InitialAppressoSchema1727800000000 implements MigrationInterface {
  name = 'InitialAppressoSchema1727800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgcrypto if gen_random_uuid() is needed on older PG versions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 1. Table: appresso_transactions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appresso_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "idTxn" character varying(128) NOT NULL,
        "userId" character varying(128) NOT NULL,
        "value" bigint NOT NULL,
        "currency" character varying(3) NOT NULL,
        "paymentMethod" character varying(50) NOT NULL,
        "declaredDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "receivedAt" bigint NOT NULL,
        "hmacSignature" character varying(64) NOT NULL,
        "anomalyEpisodeId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appresso_transactions_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_appresso_transactions_idTxn" 
      ON "appresso_transactions" ("idTxn");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_transactions_userId" 
      ON "appresso_transactions" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_transactions_receivedAt" 
      ON "appresso_transactions" ("receivedAt");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_transactions_user_received" 
      ON "appresso_transactions" ("userId", "receivedAt");
    `);

    // 2. Table: appresso_anomaly_episodes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appresso_anomaly_episodes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying(128) NOT NULL,
        "rule" character varying(64) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'OPEN',
        "openedAt" bigint NOT NULL,
        "updatedAt" bigint NOT NULL,
        "closedAt" bigint,
        "transactionCount" integer NOT NULL DEFAULT 0,
        "transactionIds" jsonb NOT NULL DEFAULT '[]',
        "reviewedBy" character varying(128),
        "notes" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "recordUpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appresso_anomaly_episodes_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_anomaly_episodes_userId" 
      ON "appresso_anomaly_episodes" ("userId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_appresso_anomaly_episodes_user_rule_status" 
      ON "appresso_anomaly_episodes" ("userId", "rule", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appresso_anomaly_episodes" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appresso_transactions" CASCADE;`);
  }
}

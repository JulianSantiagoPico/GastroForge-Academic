import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicAnalysisModule } from './modules/academic-analysis/academic-analysis.module';
import { StructuresModule } from './modules/structures/structures.module';
import { AppressoModule } from './modules/appresso/appresso.module';
import { HealthController } from './modules/health/health.controller';
import { AppressoTransactionEntity } from './modules/appresso/persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from './modules/appresso/persistence/entities/anomaly-episode.entity';

import {
  dataSourceOptions,
  validateDatabaseEnvironment,
} from './database/data-source';

// In production, DATABASE_URL is mandatory. Prevent silent fallback to in-memory mode.
validateDatabaseEnvironment();

const isPostgresEnabled = !!process.env.DATABASE_URL;

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 segundos
        limit: 120, // Límite para proteger endpoints generales
      },
    ]),
    ...(isPostgresEnabled
      ? [
          TypeOrmModule.forRootAsync({
            useFactory: () => ({
              ...dataSourceOptions,
              url: process.env.DATABASE_URL,
              synchronize: false, // Inequívocamente desactivado: el esquema se gestiona por migraciones
              migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
            }),
          }),
        ]
      : []),
    AcademicAnalysisModule,
    StructuresModule,
    AppressoModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

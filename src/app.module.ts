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

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 segundos
        limit: 120, // Límite para proteger endpoints generales
      },
    ]),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'gastroforge',
        entities: [AppressoTransactionEntity, AppressoAnomalyEpisodeEntity],
        synchronize: process.env.NODE_ENV !== 'production',
        ssl:
          process.env.DATABASE_URL?.includes('sslmode=require') ||
          process.env.DB_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
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

import { Module } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AppressoTransactionsController } from './transactions/transactions.controller';
import { AppressoAnomaliesController } from './anomalies/anomalies.controller';
import { AppressoMetricsController } from './metrics/appresso-metrics.controller';
import { AppressoAnalyticsController } from './analytics/analytics.controller';
import { SimulationController } from './simulation/simulation.controller';
import { TransactionsService } from './transactions/transactions.service';
import { AnomaliesService } from './anomalies/anomalies.service';
import { AppressoMetricsService } from './metrics/appresso-metrics.service';
import { AppressoAnalyticsService } from './analytics/analytics.service';
import { AppressoThrottlerGuard } from './throttling/appresso-throttler.guard';
import { AppressoRejectOriginInterceptor } from './throttling/appresso-reject-origin.interceptor';
import { AppressoTransactionEntity } from './persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from './persistence/entities/anomaly-episode.entity';
import { InMemoryEntityManager } from './persistence/in-memory-entity-manager';
import { TimeBandPolicy } from './fraud-detection/time-band-policy';
import { RedisSlidingWindowAdapter } from './redis/redis-sliding-window.adapter';

const isPostgres = !!process.env.DATABASE_URL;

@Module({
  imports: isPostgres
    ? [
        TypeOrmModule.forFeature([
          AppressoTransactionEntity,
          AppressoAnomalyEpisodeEntity,
        ]),
      ]
    : [],
  controllers: [
    AppressoTransactionsController,
    AppressoAnomaliesController,
    AppressoMetricsController,
    AppressoAnalyticsController,
    SimulationController,
  ],
  providers: [
    TransactionsService,
    AnomaliesService,
    AppressoMetricsService,
    AppressoAnalyticsService,
    AppressoThrottlerGuard,
    AppressoRejectOriginInterceptor,
    TimeBandPolicy,
    RedisSlidingWindowAdapter,
    ...(isPostgres
      ? []
      : [
          {
            provide: EntityManager,
            useClass: InMemoryEntityManager,
          },
          {
            // Sin `TypeOrmModule.forFeature` el token del repositorio no existe, así que
            // `AnomaliesService` no podría resolver su dependencia y el arranque fallaría. Se
            // registra el mismo token con el repositorio del gestor en memoria para que el
            // fallback sea realmente utilizable y no solo declarativo.
            provide: getRepositoryToken(AppressoAnomalyEpisodeEntity),
            useFactory: (em: InMemoryEntityManager) =>
              em.getRepository(AppressoAnomalyEpisodeEntity),
            inject: [EntityManager],
          },
        ]),
  ],
  exports: [
    TransactionsService,
    AnomaliesService,
    AppressoMetricsService,
    AppressoAnalyticsService,
    TimeBandPolicy,
    RedisSlidingWindowAdapter,
  ],
})
export class AppressoModule {}
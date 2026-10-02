import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AppressoTransactionsController } from './transactions/transactions.controller';
import { AppressoAnomaliesController } from './anomalies/anomalies.controller';
import { TransactionsService } from './transactions/transactions.service';
import { AnomaliesService } from './anomalies/anomalies.service';
import { AppressoTransactionEntity } from './persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from './persistence/entities/anomaly-episode.entity';
import { InMemoryEntityManager } from './persistence/in-memory-entity-manager';

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
  ],
  providers: [
    TransactionsService,
    AnomaliesService,
    ...(isPostgres
      ? []
      : [
          {
            provide: EntityManager,
            useClass: InMemoryEntityManager,
          },
          {
            provide: 'AppressoAnomalyEpisodeEntityRepository',
            useFactory: (em: InMemoryEntityManager) =>
              em.getRepository(AppressoAnomalyEpisodeEntity),
            inject: [EntityManager],
          },
        ]),
  ],
  exports: [TransactionsService, AnomaliesService],
})
export class AppressoModule {}

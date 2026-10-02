import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppressoTransactionsController } from './transactions/transactions.controller';
import { AppressoAnomaliesController } from './anomalies/anomalies.controller';
import { TransactionsService } from './transactions/transactions.service';
import { AnomaliesService } from './anomalies/anomalies.service';
import { AppressoTransactionEntity } from './persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from './persistence/entities/anomaly-episode.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppressoTransactionEntity,
      AppressoAnomalyEpisodeEntity,
    ]),
  ],
  controllers: [
    AppressoTransactionsController,
    AppressoAnomaliesController,
  ],
  providers: [TransactionsService, AnomaliesService],
  exports: [TransactionsService, AnomaliesService],
})
export class AppressoModule {}

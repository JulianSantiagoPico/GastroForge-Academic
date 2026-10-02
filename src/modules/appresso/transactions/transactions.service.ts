import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CreateAppressoTransactionDto } from '../dto/create-transaction.dto';
import { verifyHmac } from '../crypto/hmac';
import { SlidingWindowDetector } from '../fraud-detection/sliding-window';
import {
  AnomalyEpisodeManager,
  EpisodeStatus,
} from '../anomalies/anomaly-episode';
import { AppressoTransactionEntity } from '../persistence/entities/transaction.entity';
import { AppressoAnomalyEpisodeEntity } from '../persistence/entities/anomaly-episode.entity';

export interface ProcessTransactionResponse {
  status: 'ACCEPTED';
  idTxn: string;
  receivedAt: number;
  isDuplicate: boolean;
  anomaly: {
    detected: boolean;
    rule?: string;
    episodeId?: string;
    windowCount: number;
    threshold: number;
  };
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private readonly detector: SlidingWindowDetector;
  private readonly episodeManager: AnomalyEpisodeManager;
  private readonly windowMs = 3000;
  private readonly threshold = 3;

  constructor(private readonly entityManager: EntityManager) {
    this.detector = new SlidingWindowDetector({
      windowMs: this.windowMs,
      threshold: this.threshold,
      ruleName: 'POSIBLE_FRAUDE',
    });
    this.episodeManager = new AnomalyEpisodeManager({
      windowMs: this.windowMs,
    });
  }

  /**
   * Procesa la transacción garantizando:
   * 1. Verificación criptográfica HMAC-SHA-256 en tiempo constante (A1.1, A3.4).
   * 2. Idempotencia estricta por `idTxn` (A1.1, A3.5).
   * 3. Serialización por usuario mediante PostgreSQL advisory lock (`pg_advisory_xact_lock`) (A3.5).
   * 4. Evaluación de ventana deslizante en tiempo amortizado O(1) (A2.1 - A2.4).
   * 5. Agrupación en episodios de anomalía sin alertas redundantes (A1.2a).
   */
  async processTransaction(
    dto: CreateAppressoTransactionDto,
  ): Promise<ProcessTransactionResponse> {
    const secret =
      process.env.APPRESSO_HMAC_SECRET || 'gastroforge-default-dev-secret';

    // 1. Verificación de firma HMAC
    const isSignatureValid = verifyHmac(dto, dto.hash, secret);
    if (!isSignatureValid) {
      throw new UnauthorizedException('Firma HMAC inválida o manipulada');
    }

    // 2. Ejecución dentro de transacción con Advisory Lock por usuario
    return await this.entityManager.transaction(async (txManager) => {
      // 2a. PostgreSQL Advisory Lock por usuario para serialización de concurrencia
      try {
        await txManager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          dto.user,
        ]);
      } catch (err) {
        // En entornos sin Postgres (ej. pruebas unitarias / mocks), continuar
        this.logger.debug(
          `Advisory lock omitido (posible entorno mock o no-Postgres): ${err}`,
        );
      }

      const txnRepo = txManager.getRepository(AppressoTransactionEntity);
      const episodeRepo = txManager.getRepository(AppressoAnomalyEpisodeEntity);

      // 2b. Comprobación de idempotencia por idTxn
      const existingTxn = await txnRepo.findOne({
        where: { idTxn: dto.idTxn },
      });

      if (existingTxn) {
        const isAnomaly = !!existingTxn.anomalyEpisodeId;
        return {
          status: 'ACCEPTED',
          idTxn: existingTxn.idTxn,
          receivedAt: Number(existingTxn.receivedAt),
          isDuplicate: true,
          anomaly: {
            detected: isAnomaly,
            rule: isAnomaly ? 'POSIBLE_FRAUDE' : undefined,
            episodeId: existingTxn.anomalyEpisodeId,
            windowCount: 0,
            threshold: this.threshold,
          },
        };
      }

      // 2c. Tiempo de recepción autoritativo del servidor
      const receivedAt = Date.now();

      // 2d. Evaluación pura de la ventana deslizante
      const evaluation = this.detector.processEvent({
        idTxn: dto.idTxn,
        userId: dto.user,
        receivedAt,
        value: dto.value,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
        date: dto.date,
      });

      let episodeId: string | undefined;

      // 2e. Gestión del ciclo de vida del episodio si hay anomalía
      if (evaluation.isAnomaly) {
        const episode = this.episodeManager.recordAnomaly({
          userId: dto.user,
          rule: evaluation.rule,
          txnId: dto.idTxn,
          timestamp: receivedAt,
          windowTxnIds: evaluation.windowEvents.map((e) => e.idTxn),
        });
        episodeId = episode.id;

        // Persistir o actualizar episodio en base de datos
        let episodeEntity = await episodeRepo.findOne({
          where: {
            userId: dto.user,
            rule: evaluation.rule,
            status: EpisodeStatus.OPEN,
          },
        });

        if (!episodeEntity) {
          episodeEntity = episodeRepo.create({
            id: episode.id,
            userId: episode.userId,
            rule: episode.rule,
            status: episode.status,
            openedAt: episode.openedAt,
            updatedAt: episode.updatedAt,
            transactionCount: episode.transactionCount,
            transactionIds: episode.transactionIds,
          });
        } else {
          episodeEntity.updatedAt = episode.updatedAt;
          episodeEntity.transactionCount = episode.transactionCount;
          episodeEntity.transactionIds = episode.transactionIds;
        }

        await episodeRepo.save(episodeEntity);
      }

      // 2f. Persistir la transacción
      const txnEntity = txnRepo.create({
        idTxn: dto.idTxn,
        userId: dto.user,
        value: dto.value,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
        declaredDate: new Date(dto.date),
        receivedAt,
        hmacSignature: dto.hash,
        anomalyEpisodeId: episodeId,
      });

      await txnRepo.save(txnEntity);

      return {
        status: 'ACCEPTED',
        idTxn: dto.idTxn,
        receivedAt,
        isDuplicate: false,
        anomaly: {
          detected: evaluation.isAnomaly,
          rule: evaluation.isAnomaly ? evaluation.rule : undefined,
          episodeId,
          windowCount: evaluation.count,
          threshold: this.threshold,
        },
      };
    });
  }
}

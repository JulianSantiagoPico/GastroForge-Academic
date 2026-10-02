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
import {
  ADVISORY_LOCK_STATEMENT,
  advisoryLockKeyFor,
} from '../persistence/advisory-lock';
import { KeyedMutex } from './user-mutex';
import {
  APPRESSO_RULE_NAME,
  APPRESSO_THRESHOLD,
  APPRESSO_WINDOW_MS,
} from '../appresso.constants';
import { AppressoMetricsService, METRIC } from '../metrics/appresso-metrics.service';

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

/**
 * Servicio de ingesta de transacciones de Appresso.
 *
 * ## Serialización por usuario (A3.5)
 *
 * El cruce de umbral depende de leer y escribir el estado de la ventana del usuario como una
 * operación indivisible. Si dos peticiones del mismo usuario se procesan a la vez, ambas pueden
 * observar el mismo conteo y ambas pueden (o no) disparar la anomalía, y el resultado depende del
 * orden de llegada: el detector es correcto pero la Orchestación no lo es.
 *
 * Se combinan dos mecanismos, y cada uno cubre lo que el otro no cubre:
 *
 * 1. **Mutex por usuario en proceso** (`KeyedMutex`). Cubre el modo in-memory, donde no hay
 *    servidor de base de datos que pueda arbitrar. Usuarios distintos usan claves distintas y no
 *    se bloquean entre sí.
 * 2. **Advisory lock transaccional de PostgreSQL** (`pg_advisory_xact_lock`). Cubre el caso de
 *    varias réplicas del servicio, donde el mutex de un proceso no alcanza. Se toma **dentro** de
 *    la transacción, de modo que PostgreSQL lo libera solo al confirmar o revertir.
 *
 * El orden siempre es mutex y luego advisory lock, en todas las réplicas, así que no hay forma de
 * deadlock por orden inverso. Con PostgreSQL configurado, un fallo al tomar el advisory lock se
 * propaga: se prefiere fallar de forma explícita a procesar sin serializar y perder el cruce de
 * umbral en silencio.
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private readonly detector: SlidingWindowDetector;
  private readonly episodeManager: AnomalyEpisodeManager;
  private readonly userMutex = new KeyedMutex();

  private readonly windowMs = APPRESSO_WINDOW_MS;
  private readonly threshold = APPRESSO_THRESHOLD;

  /** Modo de persistencia resuelto en el arranque: PostgreSQL durable o fallback in-memory. */
  private readonly usesPostgres = !!process.env.DATABASE_URL;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly metrics: AppressoMetricsService,
  ) {
    this.detector = new SlidingWindowDetector({
      windowMs: this.windowMs,
      threshold: this.threshold,
      ruleName: APPRESSO_RULE_NAME,
    });
    this.episodeManager = new AnomalyEpisodeManager({
      windowMs: this.windowMs,
    });
  }

  /**
   * Procesa la transacción garantizando:
   * 1. Verificación criptográfica HMAC-SHA-256 en tiempo constante (A1.1, A3.4).
   * 2. Idempotencia estricta por `idTxn` (A1.1, A3.5).
   * 3. Serialización por usuario mediante mutex en proceso y advisory lock transaccional (A3.5).
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
      this.metrics.increment(METRIC.REJECTED_BY_HMAC);
      throw new UnauthorizedException('Firma HMAC inválida o manipulada');
    }

    // 2. Serialización por usuario. La clave es el identificador de negocio, no la clave del
    //    lock: el bloqueo agrupa por usuario y el estado del detector también.
    return await this.userMutex.runExclusive(dto.user, async () => {
      return await this.ingest(dto);
    });
  }

  /**
   * Ingestión serializada de una sola transacción. Solo se invoca desde `processTransaction`,
   * ya dentro del mutex del usuario.
   */
  private async ingest(
    dto: CreateAppressoTransactionDto,
  ): Promise<ProcessTransactionResponse> {
    return await this.entityManager.transaction(async (txManager) => {
      // 2a. Advisory lock transaccional por usuario (solo con PostgreSQL).
      if (this.usesPostgres) {
        // Sin captura de excepción a propósito: si el lock falla, la transacción se revierte y el
        // error sube. Procesar sin serializar produciría resultados no deterministas.
        await txManager.query(ADVISORY_LOCK_STATEMENT, [
          advisoryLockKeyFor(dto.user),
        ]);
      }
      this.metrics.increment(METRIC.DB_QUERIES);

      const txnRepo = txManager.getRepository(AppressoTransactionEntity);
      const episodeRepo = txManager.getRepository(AppressoAnomalyEpisodeEntity);

      // 2b. Comprobación de idempotencia por idTxn
      const existingTxn = await txnRepo.findOne({
        where: { idTxn: dto.idTxn },
      });

      if (existingTxn) {
        this.metrics.increment(METRIC.DUPLICATES_HANDLED);
        const isAnomaly = !!existingTxn.anomalyEpisodeId;
        return {
          status: 'ACCEPTED',
          idTxn: existingTxn.idTxn,
          receivedAt: Number(existingTxn.receivedAt),
          isDuplicate: true,
          anomaly: {
            detected: isAnomaly,
            rule: isAnomaly ? APPRESSO_RULE_NAME : undefined,
            episodeId: existingTxn.anomalyEpisodeId,
            windowCount: 0,
            threshold: this.threshold,
          },
        };
      }

      // 2c. Tiempo de recepción autoritativo del servidor. `date` es dato del emisor y no
      //     participa en el cálculo de la ventana.
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
        // Cierre perezoso: un episodio OPEN que ya no tiene eventos vigentes debe cerrarse ANTES
        // de decidir si este cruce actualiza el episodio anterior o abre uno nuevo (A1.2a). Sin
        // esta llamada, el índice de episodios abiertos nunca se vacía y todas las anomalías
        // futuras del mismo usuario acabarían actualizando un único episodio para siempre.
        this.episodeManager.checkAndCloseExpired(receivedAt);

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

        // El gestor en memoria ya cerró el episodio vencido en el paso anterior. La fila
        // persistida hay que cerrarla explícitamente: si no, la siguiente anomalía volvería a
        // encontrar este mismo registro OPEN y arrastraría un episodio indefinidamente, que es
        // exactamente lo que A1.2a prohíbe. Se usa la misma condición estricta `>`.
        if (
          episodeEntity &&
          receivedAt - Number(episodeEntity.updatedAt) > this.windowMs
        ) {
          episodeEntity.status = EpisodeStatus.CLOSED;
          episodeEntity.closedAt = receivedAt;
          await episodeRepo.save(episodeEntity);
          this.metrics.increment(METRIC.EPISODES_CLOSED);
          episodeEntity = null;
        }

        if (!episodeEntity) {
          this.metrics.increment(METRIC.ANOMALIES_CREATED);
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
          this.metrics.increment(METRIC.ANOMALIES_UPDATED);
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
      this.metrics.increment(METRIC.TRANSACTIONS_PROCESSED);

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
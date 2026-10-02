import {
  Injectable,
  UnauthorizedException,
  Logger,
  Optional,
} from '@nestjs/common';
import { EntityManager, MoreThanOrEqual } from 'typeorm';
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
import { TimeBandPolicy } from '../fraud-detection/time-band-policy';
import { RedisSlidingWindowAdapter } from '../redis/redis-sliding-window.adapter';

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
    timeBand?: string;
    windowMs?: number;
    source?: 'redis' | 'postgres' | 'memory';
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
  private readonly timeBandPolicy: TimeBandPolicy;
  private readonly userMutex = new KeyedMutex();

  private readonly windowMs = APPRESSO_WINDOW_MS;
  private readonly threshold = APPRESSO_THRESHOLD;

  /** Modo de persistencia resuelto en el arranque: PostgreSQL durable o fallback in-memory. */
  private readonly usesPostgres = !!process.env.DATABASE_URL;

  constructor(
    private readonly entityManager: EntityManager,
    private readonly metrics: AppressoMetricsService,
    @Optional() timeBandPolicy?: TimeBandPolicy,
    @Optional() private readonly redisAdapter?: RedisSlidingWindowAdapter,
  ) {
    this.timeBandPolicy =
      timeBandPolicy ?? new TimeBandPolicy({ windowMs: this.windowMs });
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
        const dupBand = this.timeBandPolicy.evaluate(Number(existingTxn.receivedAt));
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
            threshold: dupBand.threshold,
            timeBand: dupBand.band,
            windowMs: this.windowMs,
          },
        };
      }

      // 2c. Tiempo de recepción autoritativo del servidor en UTC. `date` es dato del emisor y no
      //     participa en el cálculo de la ventana.
      const receivedAt = Date.now();

      // 2c.1 Evaluación de franja horaria y umbral aplicable en UTC (W2)
      const bandEval = this.timeBandPolicy.evaluate(receivedAt);
      const effectiveThreshold = bandEval.threshold;

      // 2d. Evaluación de ventana deslizante (W3: Redis compartido, fallback PostgreSQL acotado o en memoria)
      let windowCount = 1;
      let isAnomaly = false;
      let windowTxnIds: string[] = [dto.idTxn];
      let evaluationSource: 'redis' | 'postgres' | 'memory' = 'memory';

      // 2d.1 Intento prioritario con Redis si el adaptador está disponible
      let redisResult = null;
      if (this.redisAdapter?.isAvailable()) {
        if (
          this.redisAdapter.getCircuitState() === 'HALF_OPEN' &&
          this.usesPostgres
        ) {
          const activeTxns = await txnRepo.find({
            where: {
              userId: dto.user,
              receivedAt: MoreThanOrEqual(receivedAt - this.windowMs),
            },
            order: { receivedAt: 'ASC' },
          });
          await this.redisAdapter.reconstructActiveWindow(
            dto.user,
            activeTxns.map((t) => ({
              idTxn: t.idTxn,
              receivedAt: Number(t.receivedAt),
            })),
            this.windowMs,
          );
        }

        redisResult = await this.redisAdapter.recordAndCount(
          dto.user,
          { idTxn: dto.idTxn, receivedAt },
          this.windowMs,
        );
      }

      if (redisResult) {
        evaluationSource = 'redis';
        windowCount = redisResult.count;
        isAnomaly = windowCount >= effectiveThreshold;

        if (isAnomaly && this.usesPostgres) {
          const activeTxns = await txnRepo.find({
            where: {
              userId: dto.user,
              receivedAt: MoreThanOrEqual(receivedAt - this.windowMs),
            },
            select: ['idTxn'],
          });
          windowTxnIds = [...activeTxns.map((t) => t.idTxn), dto.idTxn];
        }
      } else if (this.usesPostgres) {
        // 2d.2 Fallback a PostgreSQL: consulta acotada a la ventana activa (receivedAt >= now - windowMs)
        evaluationSource = 'postgres';
        const activeTxns = await txnRepo.find({
          where: {
            userId: dto.user,
            receivedAt: MoreThanOrEqual(receivedAt - this.windowMs),
          },
          order: { receivedAt: 'ASC' },
        });
        windowTxnIds = [...activeTxns.map((t) => t.idTxn), dto.idTxn];
        windowCount = windowTxnIds.length;
        isAnomaly = windowCount >= effectiveThreshold;
      } else {
        // 2d.3 Fallback a detector en memoria (modo local / tests sin DB)
        evaluationSource = 'memory';
        const evaluation = this.detector.processEvent(
          {
            idTxn: dto.idTxn,
            userId: dto.user,
            receivedAt,
            value: dto.value,
            currency: dto.currency,
            paymentMethod: dto.paymentMethod,
            date: dto.date,
          },
          effectiveThreshold,
        );
        windowCount = evaluation.count;
        isAnomaly = evaluation.isAnomaly;
        windowTxnIds = evaluation.windowEvents.map((e) => e.idTxn);
      }

      let episodeId: string | undefined;

      // 2e. Gestión del ciclo de vida del episodio si hay anomalía
      if (isAnomaly) {
        // Cierre perezoso: un episodio OPEN que ya no tiene eventos vigentes debe cerrarse ANTES
        // de decidir si este cruce actualiza el episodio anterior o abre uno nuevo (A1.2a). Sin
        // esta llamada, el índice de episodios abiertos nunca se vacía y todas las anomalías
        // futuras del mismo usuario acabarían actualizando un único episodio para siempre.
        this.episodeManager.checkAndCloseExpired(receivedAt);

        const episodeNotes = JSON.stringify({
          timeBand: bandEval.band,
          threshold: effectiveThreshold,
          windowMs: this.windowMs,
          source: evaluationSource,
        });

        const episode = this.episodeManager.recordAnomaly({
          userId: dto.user,
          rule: APPRESSO_RULE_NAME,
          txnId: dto.idTxn,
          timestamp: receivedAt,
          windowTxnIds,
          notes: episodeNotes,
        });
        episodeId = episode.id;

        // Persistir o actualizar episodio en base de datos
        let episodeEntity = await episodeRepo.findOne({
          where: {
            userId: dto.user,
            rule: APPRESSO_RULE_NAME,
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
            notes: episodeNotes,
          });
        } else {
          this.metrics.increment(METRIC.ANOMALIES_UPDATED);
          episodeEntity.updatedAt = episode.updatedAt;
          episodeEntity.transactionCount = episode.transactionCount;
          episodeEntity.transactionIds = episode.transactionIds;
          episodeEntity.notes = episodeNotes;
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
          detected: isAnomaly,
          rule: isAnomaly ? APPRESSO_RULE_NAME : undefined,
          episodeId,
          windowCount,
          threshold: effectiveThreshold,
          timeBand: bandEval.band,
          windowMs: this.windowMs,
          source: evaluationSource,
        },
      };
    });
  }
}
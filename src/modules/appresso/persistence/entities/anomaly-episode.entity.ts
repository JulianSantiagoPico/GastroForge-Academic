import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EpisodeStatus } from '../../anomalies/anomaly-episode';

@Entity('appresso_anomaly_episodes')
@Index(['userId', 'rule', 'status'])
export class AppressoAnomalyEpisodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  rule: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: EpisodeStatus.OPEN,
  })
  status: EpisodeStatus;

  @Index()
  @Column({ type: 'bigint' })
  openedAt: number; // Unix epoch ms

  @Column({ type: 'bigint' })
  updatedAt: number; // Unix epoch ms

  @Column({ type: 'bigint', nullable: true })
  closedAt?: number; // Unix epoch ms

  @Column({ type: 'int', default: 0 })
  transactionCount: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  transactionIds: string[];

  @Column({ type: 'varchar', length: 128, nullable: true })
  reviewedBy?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  recordUpdatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('appresso_transactions')
@Index(['userId', 'receivedAt'])
export class AppressoTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  idTxn: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  userId: string;

  @Column({ type: 'bigint' })
  value: number; // Unidades mínimas (centavos)

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({ type: 'timestamptz' })
  declaredDate: Date;

  @Index()
  @Column({ type: 'bigint' })
  receivedAt: number; // Unix epoch en milisegundos

  @Column({ type: 'varchar', length: 64 })
  hmacSignature: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  anomalyEpisodeId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

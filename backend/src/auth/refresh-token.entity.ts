import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: number;

  /** SHA-256 hex of the raw JWT string */
  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['roomId', 'createdAt'])
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  roomId: string;

  @Column()
  authorId: number;

  @Column({ length: 80 })
  authorName: string;

  /** 발신 시점의 `/uploads/avatars/...` (없으면 null) */
  @Column({ type: 'varchar', length: 512, nullable: true })
  authorImageUrl: string | null;

  @Column('text')
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}

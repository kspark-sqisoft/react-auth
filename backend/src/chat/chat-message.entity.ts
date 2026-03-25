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

  @Column('text')
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}

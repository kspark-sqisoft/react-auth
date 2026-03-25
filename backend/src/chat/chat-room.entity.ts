import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class ChatRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, unique: true })
  roomId: string;

  @Column()
  ownerId: number;

  @Column({ length: 80 })
  ownerName: string;

  @CreateDateColumn()
  createdAt: Date;
}

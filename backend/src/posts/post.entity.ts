import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import type { PostLike } from './post-like.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  content: string;

  /** uploads/posts/ 아래 저장 파일명 (확장자 포함) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  imageFilename: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  author: User;

  @OneToMany('PostLike', 'post')
  likes: PostLike[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

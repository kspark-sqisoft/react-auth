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
import type { PostComment } from './post-comment.entity';
import type { PostAttachment } from './post-attachment.entity';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  author: User;

  @OneToMany('PostAttachment', 'post', { cascade: ['insert', 'update'] })
  attachments: PostAttachment[];

  @OneToMany('PostLike', 'post')
  likes: PostLike[];

  @OneToMany('PostComment', 'post')
  comments: PostComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

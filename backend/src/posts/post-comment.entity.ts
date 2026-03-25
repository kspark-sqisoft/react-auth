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
import { Post } from './post.entity';

@Entity()
export class PostComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  content: string;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  post: Post;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  author: User;

  @ManyToOne(() => PostComment, (c) => c.replies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  parent: PostComment | null;

  @OneToMany(() => PostComment, (c) => c.parent)
  replies: PostComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

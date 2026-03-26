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

  /** uploads/post-videos/ 아래 저장 파일명 */
  @Column({ type: 'varchar', length: 255, nullable: true })
  videoFilename: string | null;

  /** uploads/post-video-posters/ 아래 저장 파일명 (목록 썸네일·플레이어 poster) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  videoPosterFilename: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  author: User;

  @OneToMany('PostLike', 'post')
  likes: PostLike[];

  @OneToMany('PostComment', 'post')
  comments: PostComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

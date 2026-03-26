import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Post } from './post.entity';

@Entity()
export class PostAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  postId: number;

  @ManyToOne(() => Post, (p) => p.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ type: 'int' })
  sortOrder: number;

  @Column({ type: 'varchar', length: 8 })
  kind: 'image' | 'video';

  @Column({ type: 'varchar', length: 255 })
  fileFilename: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  posterFilename: string | null;
}

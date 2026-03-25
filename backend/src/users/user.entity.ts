import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import type { Post } from '../posts/post.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ default: '' })
  name: string;

  @Column()
  password: string;

  @OneToMany('Post', 'author')
  posts: Post[];
}

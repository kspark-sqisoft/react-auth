import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import type { Book } from '../books/book.entity';
import type { Post } from '../posts/post.entity';
import { UserRole } from './user-role';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 16, default: UserRole.User })
  role: UserRole;

  @Column({ default: '' })
  name: string;

  /** uploads/avatars/ 아래 저장 파일명 (확장자 포함) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  profileImageFilename: string | null;

  @Column()
  password: string;

  @OneToMany('Post', 'author')
  posts: Post[];

  @OneToMany('Book', 'author')
  books: Book[];
}

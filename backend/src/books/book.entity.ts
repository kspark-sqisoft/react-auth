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
import { BookPage } from './book-page.entity';

@Entity()
export class Book {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  title: string;

  /** 모든 슬라이드 공통 캔버스 너비(px) */
  @Column({ type: 'int', default: 960 })
  slideWidth: number;

  /** 모든 슬라이드 공통 캔버스 높이(px) */
  @Column({ type: 'int', default: 540 })
  slideHeight: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  author: User;

  @OneToMany(() => BookPage, (p) => p.book)
  pages: BookPage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

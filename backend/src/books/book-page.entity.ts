import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Book } from './book.entity';

@Entity()
export class BookPage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Book, (b) => b.pages, { onDelete: 'CASCADE' })
  book: Book;

  @Column({ type: 'int' })
  sortOrder: number;

  /** 목록·속성 패널에 표시할 슬라이드 이름(비우면 클라이언트에서 "슬라이드 n") */
  @Column({ type: 'varchar', length: 120, default: '' })
  slideName: string;

  /** JSON 배열: 텍스트·이미지·비디오 요소 */
  @Column({ type: 'text', default: '[]' })
  elementsJson: string;

  /** 슬라이드 배경색(CSS 색 문자열, 예: #ffffff) */
  @Column({ type: 'varchar', length: 64, default: '#ffffff' })
  backgroundColor: string;

  /** 미리보기 시 이 페이지 체류 시간을 결정하는 요소 UUID(같은 페이지 elementsJson 내 id) */
  @Column({ type: 'varchar', length: 80, nullable: true })
  presentationTimingElementId: string | null;

  /**
   * 슬라이드쇼에서 이 페이지로 들어올 때 전환 효과(none·fade·slide…).
   * 기본 none — 즉시 전환.
   */
  @Column({ type: 'varchar', length: 24, default: 'none' })
  presentationTransition: string;

  /** 전환 지속 시간(ms). 80~2500 권장 */
  @Column({ type: 'int', default: 450 })
  presentationTransitionMs: number;
}

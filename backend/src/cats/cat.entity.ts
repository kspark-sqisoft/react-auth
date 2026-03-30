import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Entity (엔티티) — TypeORM
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: 클래스 필드와 DB 테이블 컬럼을 매핑합니다. `synchronize: true`(개발용)이면
 *   스키마가 엔티티 정의에 맞춰 자동 반영될 수 있습니다. 운영에서는 마이그레이션 권장.
 * - @Entity('테이블명') : 실제 SQLite 테이블 이름. 기본 엔티티들과 겹치지 않게 study_cats 로 둠.
 * - @Column, @PrimaryGeneratedColumn, @CreateDateColumn 등 : 컬럼 타입·제약·자동 채움 규칙.
 *
 * Nest 연결
 * - CatsModule에서 TypeOrmModule.forFeature([Cat]) 로 등록해야 @InjectRepository(Cat) 사용 가능.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Entity('study_cats')
export class Cat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'int', default: 1 })
  age: number;

  @Column({ default: 'mixed' })
  breed: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

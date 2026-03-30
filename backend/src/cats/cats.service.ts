import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cat } from './cat.entity';
import type { CreateCatDto } from './dto/create-cat.dto';
import { CatNotFoundException } from './exceptions/cat-not-found.exception';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Service (서비스)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: 도메인 규칙과 데이터 접근(여기서는 TypeORM Repository)을 담당합니다.
 * - @Injectable() 으로 Nest DI에 등록되며, 컨트롤러 생성자 주입으로 사용합니다.
 * - 컨트롤러는 “HTTP 관점”, 서비스는 “비즈니스 관점”으로 나누면 테스트·재사용이 쉬워집니다.
 *
 * 예외 처리와 Filter의 관계
 * - 여기서 throw하는 CatNotFoundException은 HTTP 관점에서 404에 해당합니다.
 * - 컨트롤러에 붙인 ExceptionFilter가 이 타입만 골라 잡아, 클라이언트에 줄 JSON 형태를 바꿉니다.
 *   (Filter가 없어도 Nest 기본 예외 응답으로 404는 나갑니다.)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Injectable()
export class CatsService {
  private readonly logger = new Logger('CatsService');

  constructor(
    @InjectRepository(Cat)
    private readonly cats: Repository<Cat>,
  ) {}

  findAll(): Promise<Cat[]> {
    this.logger.log(`[CATS-10-SVC] findAll() | DB 조회 시작`);
    return this.cats.find({ order: { id: 'ASC' } }).then((rows) => {
      this.logger.log(`[CATS-10-SVC] findAll() | 완료 ${rows.length}건`);
      return rows;
    });
  }

  async findOne(id: number): Promise<Cat> {
    this.logger.log(`[CATS-10-SVC] findOne(${id}) | DB 조회`);
    const cat = await this.cats.findOne({ where: { id } });
    if (!cat) {
      this.logger.warn(`[CATS-10-SVC] findOne(${id}) | 없음 → 404 예외`);
      throw new CatNotFoundException(id);
    }
    this.logger.log(`[CATS-10-SVC] findOne(${id}) | 조회 성공`);
    return cat;
  }

  async create(dto: CreateCatDto): Promise<Cat> {
    this.logger.log(
      `[CATS-10-SVC] create() | name=${dto.name} age=${dto.age} breed=${dto.breed}`,
    );
    const row = this.cats.create({
      name: dto.name,
      age: dto.age ?? 1,
      breed: dto.breed ?? 'mixed',
    });
    const saved = await this.cats.save(row);
    this.logger.log(`[CATS-10-SVC] create() | 완료 id=${saved.id}`);
    return saved;
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`[Cats 학습 Service] remove(${id}) — 존재 확인 후 삭제`);
    await this.findOne(id);
    await this.cats.delete(id);
    this.logger.log(`[CATS-10-SVC] remove(${id}) | 완료`);
  }
}

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Repository } from 'typeorm';
import { type AuthActor, canMutateCatResource } from '../auth/auth-policy';
import { CAT_IMAGES_SUBDIR, UPLOAD_ROOT } from '../env.constants';
import { Cat } from './cat.entity';
import type { CreateCatDto } from './dto/create-cat.dto';
import type { UpdateCatDto } from './dto/update-cat.dto';
import { CatNotFoundException } from './exceptions/cat-not-found.exception';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Service (서비스)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: 도메인 규칙과 데이터 접근(여기서는 TypeORM **Repository(Cat)**)을 담당합니다.
 * - 생성자 `@InjectRepository(Cat)` 로 받은 `this.cats` 가 ⑦ Repository 단계 — `find` / `findOne` / `save` / `delete`.
 * - @Injectable() 으로 Nest DI에 등록되며, 컨트롤러 생성자 주입으로 사용합니다.
 * - 컨트롤러는 “HTTP 관점”, 서비스는 “비즈니스 관점”으로 나누면 테스트·재사용이 쉬워집니다.
 *
 * 파이프라인에서의 위치: Middleware→Guard→Interceptor→**Pipe→Controller→(여기 Service→Repository)**.
 * 전체 순서: **REQUEST_FLOW.md**
 *
 * 예외 처리와 Filter의 관계
 * - 여기서 throw하는 CatNotFoundException은 HTTP 관점에서 404에 해당합니다.
 * - 컨트롤러에 붙인 ExceptionFilter가 이 타입만 골라 잡아, 클라이언트에 줄 JSON 형태를 바꿉니다.
 *   (Filter가 없어도 Nest 기본 예외 응답으로 404는 나갑니다.)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export type CatPublic = {
  id: number;
  name: string;
  age: number;
  breed: string;
  /** `/uploads/cat-images/...` 또는 null */
  imageUrl: string | null;
  /** 등록자 user id; 레거시 데이터는 null */
  ownerId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CatsService {
  private readonly logger = new Logger('CatsService');

  constructor(
    @InjectRepository(Cat)
    private readonly cats: Repository<Cat>,
  ) {}

  private imagePublicUrl(filename: string | null | undefined): string | null {
    const f = filename?.trim();
    if (!f) return null;
    return `/uploads/${CAT_IMAGES_SUBDIR}/${f}`;
  }

  toPublic(row: Cat): CatPublic {
    return {
      id: row.id,
      name: row.name,
      age: row.age,
      breed: row.breed,
      imageUrl: this.imagePublicUrl(row.imageFilename),
      ownerId: row.owner?.id ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async unlinkCatImage(
    filename: string | null | undefined,
  ): Promise<void> {
    const f = filename?.trim();
    if (!f) return;
    const p = join(UPLOAD_ROOT, CAT_IMAGES_SUBDIR, f);
    await unlink(p).catch(() => undefined);
  }

  async findAll(): Promise<CatPublic[]> {
    this.logger.log(`[CATS·서비스] findAll() | DB 조회 시작`);
    const rows = await this.cats.find({
      order: { id: 'ASC' },
      relations: ['owner'],
    });
    this.logger.log(`[CATS·서비스] findAll() | 완료 ${rows.length}건`);
    return rows.map((r) => this.toPublic(r));
  }

  private async findEntity(id: number): Promise<Cat> {
    const cat = await this.cats.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!cat) {
      this.logger.warn(`[CATS·서비스] findEntity(${id}) | 없음 → 404 예외`);
      throw new CatNotFoundException(id);
    }
    return cat;
  }

  async findOne(id: number): Promise<CatPublic> {
    this.logger.log(`[CATS·서비스] findOne(${id}) | DB 조회`);
    const cat = await this.findEntity(id);
    this.logger.log(`[CATS·서비스] findOne(${id}) | 조회 성공`);
    return this.toPublic(cat);
  }

  async create(dto: CreateCatDto, ownerId: number): Promise<CatPublic> {
    this.logger.log(
      `[CATS·서비스] create() | name=${dto.name} age=${dto.age} breed=${dto.breed} ownerId=${ownerId}`,
    );
    const row = this.cats.create({
      name: dto.name,
      age: dto.age ?? 1,
      breed: dto.breed ?? 'mixed',
      imageFilename: null,
      owner: { id: ownerId },
    });
    const saved = await this.cats.save(row);
    const withOwner = await this.cats.findOneOrFail({
      where: { id: saved.id },
      relations: ['owner'],
    });
    this.logger.log(`[CATS·서비스] create() | 완료 id=${saved.id}`);
    return this.toPublic(withOwner);
  }

  async update(
    id: number,
    dto: UpdateCatDto,
    actor: AuthActor,
  ): Promise<CatPublic> {
    this.logger.log(`[CATS·서비스] update(${id})`);
    const cat = await this.findEntity(id);
    if (!canMutateCatResource(actor, cat.owner?.id ?? null)) {
      throw new ForbiddenException();
    }
    if (dto.name !== undefined) cat.name = dto.name;
    if (dto.age !== undefined) cat.age = dto.age;
    if (dto.breed !== undefined) cat.breed = dto.breed;
    await this.cats.save(cat);
    this.logger.log(`[CATS·서비스] update(${id}) | 완료`);
    return this.toPublic(cat);
  }

  async uploadImage(
    id: number,
    storedFilename: string,
    actor: AuthActor,
  ): Promise<CatPublic> {
    this.logger.log(
      `[CATS·서비스] uploadImage(${id}) | file=${storedFilename}`,
    );
    const cat = await this.findEntity(id);
    if (!canMutateCatResource(actor, cat.owner?.id ?? null)) {
      throw new ForbiddenException();
    }
    const prev = cat.imageFilename;
    cat.imageFilename = storedFilename;
    await this.cats.save(cat);
    if (prev && prev !== storedFilename) {
      await this.unlinkCatImage(prev);
    }
    return this.toPublic(cat);
  }

  async remove(id: number, actor: AuthActor): Promise<void> {
    this.logger.log(`[CATS·서비스] remove(${id}) | 존재 확인 후 삭제`);
    const cat = await this.findEntity(id);
    if (!canMutateCatResource(actor, cat.owner?.id ?? null)) {
      throw new ForbiddenException();
    }
    await this.unlinkCatImage(cat.imageFilename);
    await this.cats.delete(id);
    this.logger.log(`[CATS·서비스] remove(${id}) | 완료`);
  }
}

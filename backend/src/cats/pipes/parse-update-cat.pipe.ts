import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { UpdateCatDto } from '../dto/update-cat.dto';

/** PATCH body 검증 — 실행 순서는 `REQUEST_FLOW.md` (Pipe 단계). */
@Injectable()
export class ParseUpdateCatPipe implements PipeTransform<
  unknown,
  UpdateCatDto
> {
  private readonly logger = new Logger('CatsPipeUpdateBody');

  transform(value: unknown, _metadata: ArgumentMetadata): UpdateCatDto {
    this.logger.log(`[CATS·파이프·수정본문] 검증·정규화 시작`);
    if (value === null || typeof value !== 'object') {
      throw new BadRequestException('JSON body 가 필요합니다.');
    }
    const body = value as Record<string, unknown>;
    const hasName = Object.hasOwn(body, 'name');
    const hasAge = Object.hasOwn(body, 'age');
    const hasBreed = Object.hasOwn(body, 'breed');
    if (!hasName && !hasAge && !hasBreed) {
      throw new BadRequestException(
        'name, age, breed 중 최소 하나는 보내야 합니다.',
      );
    }

    const dto: UpdateCatDto = {};

    if (hasName) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        throw new BadRequestException(
          'name 은 비어 있지 않은 문자열이어야 합니다.',
        );
      }
      dto.name = body.name.trim();
    }

    if (hasAge) {
      if (body.age === null) {
        throw new BadRequestException('age 는 null 일 수 없습니다.');
      }
      const n = Number(body.age);
      if (!Number.isInteger(n) || n < 0 || n > 40) {
        throw new BadRequestException('age 는 0~40 정수여야 합니다.');
      }
      dto.age = n;
    }

    if (hasBreed) {
      if (typeof body.breed !== 'string') {
        throw new BadRequestException('breed 는 문자열이어야 합니다.');
      }
      const b = body.breed.trim();
      dto.breed = b || 'mixed';
    }

    this.logger.log(`[CATS·파이프·수정본문] 완료`);
    return dto;
  }
}

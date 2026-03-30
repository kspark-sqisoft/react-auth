import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { CreateCatDto } from '../dto/create-cat.dto';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Pipe (파이프)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: 라우트 핸들러가 인자를 받기 “직전”에 동작합니다. 변환(transform)·검증(validation)에 씁니다.
 * - PipeTransform<TInput, TOutput> : transform()의 반환값이 최종적으로 핸들러 인자로 전달됩니다.
 * - 내장 예: ParseIntPipe, ValidationPipe(전역/파라미터), ParseBoolPipe 등.
 *
 * 실행 시점
 * - Guard 이후, Interceptor의 “핸들러 호출 전” 구간과 함께 생각하면 됩니다.
 * - @Body(ParseCreateCatPipe) 처럼 “어느 인자에 어떤 Pipe를 쓸지”를 지정합니다.
 *
 * 이 Pipe는 class-validator 없이 직접 검증해, 의존성을 늘리지 않고 학습용으로 동작을 명확히 합니다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Injectable()
export class ParseCreateCatPipe implements PipeTransform<
  unknown,
  CreateCatDto
> {
  private readonly logger = new Logger('CatsPipeBody');

  transform(value: unknown, _metadata: ArgumentMetadata): CreateCatDto {
    this.logger.log(
      `[CATS-07-PBD] Pipe body | ParseCreateCatPipe 검증·정규화 시작`,
    );
    if (value === null || typeof value !== 'object') {
      throw new BadRequestException('JSON body 가 필요합니다.');
    }
    const body = value as Record<string, unknown>;
    const nameRaw = body.name;
    if (typeof nameRaw !== 'string' || !nameRaw.trim()) {
      throw new BadRequestException(
        'name 은 비어 있지 않은 문자열이어야 합니다.',
      );
    }
    let age = 1;
    if (body.age !== undefined && body.age !== null) {
      const n = Number(body.age);
      if (!Number.isInteger(n) || n < 0 || n > 40) {
        throw new BadRequestException('age 는 0~40 정수여야 합니다.');
      }
      age = n;
    }
    const breed =
      typeof body.breed === 'string' && body.breed.trim()
        ? String(body.breed).trim()
        : 'mixed';
    const dto = { name: nameRaw.trim(), age, breed };
    this.logger.log(
      `[CATS-07-PBD] Pipe body | 완료 → CreateCatDto(name,age,breed)`,
    );
    return dto;
  }
}

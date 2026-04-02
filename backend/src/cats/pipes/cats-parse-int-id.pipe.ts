import {
  Injectable,
  Logger,
  PipeTransform,
  ArgumentMetadata,
} from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';

const inner = new ParseIntPipe();

/**
 * 내장 ParseIntPipe와 동일 동작 + 학습용 로그(:id 문자열 → number).
 * Nest 순서상 Guard·Interceptor(`next.handle()` 경로) 다음, 컨트롤러 직전 — `REQUEST_FLOW.md`.
 */
@Injectable()
export class CatsParseIntIdPipe implements PipeTransform<
  string,
  Promise<number>
> {
  private readonly logger = new Logger('CatsPipeParamId');

  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    this.logger.log(
      `[CATS·파이프·경로ID] :id "${value}" → 숫자 변환 (실패 시 400)`,
    );
    return inner.transform(value, metadata);
  }
}

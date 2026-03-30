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
 */
@Injectable()
export class CatsParseIntIdPipe implements PipeTransform<
  string,
  Promise<number>
> {
  private readonly logger = new Logger('CatsPipeParamId');

  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    this.logger.log(
      `[CATS-06-PID] Pipe :id | "${value}" → number | 실패 시 400`,
    );
    return inner.transform(value, metadata);
  }
}

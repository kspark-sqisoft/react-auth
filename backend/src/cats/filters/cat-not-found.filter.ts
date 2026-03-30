import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CatNotFoundException } from '../exceptions/cat-not-found.exception';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Exception Filter (예외 필터)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: throw된 예외 중 “지정한 타입”만 골라 잡아, HTTP 응답(status, body)을 직접 작성할 수 있습니다.
 * - @Catch(CatNotFoundException) : 이 클래스의 catch()는 해당 예외(및 서브클래스)에만 적용됩니다.
 * - ArgumentsHost : HTTP뿐 아니라 RPC, WS 등 실행 컨텍스트를 추상화 — 여기서는 switchToHttp().
 *
 * 전역 등록 vs 컨트롤러 등록
 * - app.useGlobalFilters(...) : 앱 전체.
 * - @UseFilters(...) : 특정 컨트롤러/핸들러만 (이 프로젝트는 CatsController에 적용).
 *
 * Nest 기본 예외 응답 대신, 학습용으로 error 코드·hint 필드를 붙여 형식을 구분해 봅니다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Catch(CatNotFoundException)
export class CatNotFoundFilter implements ExceptionFilter {
  private readonly logger = new Logger('CatsExceptionFilter');

  catch(exception: CatNotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = exception.getStatus();
    this.logger.warn(
      `[CATS·예외필터] CatNotFound → HTTP ${status} │ ${exception.message}`,
    );
    res.status(status).json({
      statusCode: status,
      error: 'CatNotFound',
      message: exception.message,
      hint: 'ExceptionFilter(CatNotFoundException) 가 응답을 꾸몄습니다.',
    });
  }
}

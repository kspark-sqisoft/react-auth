import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  type Type,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { Request } from 'express';

export type DomainSpanInterceptorOptions = {
  reqTag: string;
  loggerContext: string;
};

/**
 * Cats의 `CatsLoggingInterceptor`와 동일한 전·후·에러 태그 패턴.
 */
export function createDomainSpanInterceptor(
  options: DomainSpanInterceptorOptions,
): new (...args: unknown[]) => NestInterceptor {
  const { reqTag, loggerContext } = options;

  @Injectable()
  class DomainSpanInterceptor implements NestInterceptor {
    private readonly logger = new Logger(loggerContext);

    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> {
      const req = context
        .switchToHttp()
        .getRequest<Request & { method: string; url: string }>();
      const started = Date.now();
      const id = req.requestLogId ?? '—';
      this.logger.log(
        `[${reqTag}·인터셉터·직전] ${req.method} ${req.url} │ id=${id} │ 파이프·컨트롤러·서비스 직전`,
      );
      return next.handle().pipe(
        tap(() => {
          const ms = Date.now() - started;
          this.logger.log(
            `[${reqTag}·인터셉터·완료] ${req.method} ${req.url} │ id=${id} │ 핸들러 ${ms}ms`,
          );
        }),
        catchError((err: unknown) => {
          const ms = Date.now() - started;
          const name = err instanceof Error ? err.constructor.name : typeof err;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `[${reqTag}·인터셉터·에러] ${req.method} ${req.url} │ id=${id} │ ${name}: ${msg} │ 핸들러 ${ms}ms → 예외필터`,
          );
          return throwError(() => err);
        }),
      );
    }
  }

  return DomainSpanInterceptor as Type<NestInterceptor>;
}

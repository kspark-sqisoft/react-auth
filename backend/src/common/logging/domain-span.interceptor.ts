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
        .getRequest<{ method: string; url: string }>();
      const started = Date.now();
      this.logger.log(
        `[${reqTag}-05-IXIN] Interceptor 전 | next.handle() 호출 | 내부: Pipe→CTRL→SVC`,
      );
      return next.handle().pipe(
        tap(() => {
          const ms = Date.now() - started;
          this.logger.log(
            `[${reqTag}-11-IXOUT] Interceptor 후 | ${req.method} ${req.url} | OK ${ms}ms`,
          );
        }),
        catchError((err: unknown) => {
          const ms = Date.now() - started;
          const name = err instanceof Error ? err.constructor.name : typeof err;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `[${reqTag}-12-IXERR] Interceptor 에러 재전파 | ${name}: ${msg} | ${ms}ms | Filter/Exception 계층이 처리`,
          );
          return throwError(() => err);
        }),
      );
    }
  }

  return DomainSpanInterceptor as Type<NestInterceptor>;
}

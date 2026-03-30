import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import type { Request } from 'express';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Interceptor (인터셉터)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: 핸들러 실행 “전후”에 추가 로직을 넣습니다. RxJS Observable 흐름을 감쌉니다.
 * - next.handle() : 실제 컨트롤러·Pipe까지 포함한 나머지 파이프라인을 실행하는 Observable입니다.
 * - pipe(tap(...)) : 응답이 성공적으로 나온 뒤(에러가 아닌 complete 경로) 부가 작업 — 여기서는 소요 시간 로그.
 *
 * 흔한 활용
 * - 응답 데이터 가공(map), 에러 로깅(catchError), 타임아웃, 캐시, 트랜잭션 경계 등.
 *
 * Guard / Pipe 와의 차이
 * - Guard: “실행 여부” 허가. Interceptor: 실행 전후 래핑·횡단 관심사.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Injectable()
export class CatsLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('CatsLoggingInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { method: string; url: string }>();
    const started = Date.now();
    const id = req.requestLogId ?? '—';
    this.logger.log(
      `[CATS·인터셉터·직전] ${req.method} ${req.url} │ id=${id} │ 파이프·컨트롤러·서비스 직전`,
    );
    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - started;
        this.logger.log(
          `[CATS·인터셉터·완료] ${req.method} ${req.url} │ id=${id} │ 핸들러 ${ms}ms`,
        );
      }),
      catchError((err: unknown) => {
        const ms = Date.now() - started;
        const name = err instanceof Error ? err.constructor.name : typeof err;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[CATS·인터셉터·에러] ${req.method} ${req.url} │ id=${id} │ ${name}: ${msg} │ 핸들러 ${ms}ms → 예외필터`,
        );
        return throwError(() => err);
      }),
    );
  }
}

import { Injectable, Logger, NestMiddleware, type Type } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const REQ_LINE = '============================================================';

export type DomainSpanMiddlewareOptions = {
  /** e.g. 'AUTH' → `[AUTH REQ START]` */
  reqTag: string;
  /** Nest `Logger` context (콘솔 대괄호 이름) */
  loggerContext: string;
};

/**
 * Cats의 `CatsLoggerMiddleware`와 동일한 “요청 단위 구분선” 패턴을
 * 다른 HTTP 도메인에 재사용하기 위한 팩토리.
 */
export function createDomainSpanMiddleware(
  options: DomainSpanMiddlewareOptions,
): new (...args: unknown[]) => NestMiddleware {
  const { reqTag, loggerContext } = options;

  @Injectable()
  class DomainSpanMiddleware implements NestMiddleware {
    private readonly logger = new Logger(loggerContext);

    use(req: Request, res: Response, next: NextFunction): void {
      this.logger.warn(REQ_LINE);
      this.logger.warn(
        `[${reqTag} REQ START] ${req.method} ${req.originalUrl} — 아래부터 이 요청의 파이프라인 로그`,
      );
      this.logger.warn(REQ_LINE);
      this.logger.log(
        `[${reqTag}-01-MW] 요청 진입 | ${req.method} ${req.originalUrl} | 다음: 라우팅→Guard/Interceptor/Pipe`,
      );
      res.on('finish', () => {
        this.logger.warn(REQ_LINE);
        this.logger.warn(
          `[${reqTag} REQ END] ${req.method} ${req.originalUrl} | HTTP ${res.statusCode} — 응답 전송 완료`,
        );
        this.logger.warn(REQ_LINE);
      });
      next();
    }
  }

  return DomainSpanMiddleware as Type<NestMiddleware>;
}

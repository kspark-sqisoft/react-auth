import { Injectable, Logger, NestMiddleware, type Type } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  logHttpSpanClose,
  logHttpSpanOpen,
  markRequestSpanStart,
} from './http-request-span.log';

export type DomainSpanMiddlewareOptions = {
  /** e.g. 'AUTH' → 로그에 `AUTH` 열로 표시 */
  reqTag: string;
  /** Nest `Logger` context (콘솔 대괄호 이름) */
  loggerContext: string;
};

/**
 * 도메인별 HTTP 미들웨어: 요청 시작·끝을 한 줄씩 (`http-request-span.log`).
 * 콘솔 검색: `[진입]`, `[완료]`, 또는 `id=xxxxxxxx`.
 */
export function createDomainSpanMiddleware(
  options: DomainSpanMiddlewareOptions,
): new (...args: unknown[]) => NestMiddleware {
  const { reqTag, loggerContext } = options;

  @Injectable()
  class DomainSpanMiddleware implements NestMiddleware {
    private readonly logger = new Logger(loggerContext);

    use(req: Request, res: Response, next: NextFunction): void {
      markRequestSpanStart(req);
      logHttpSpanOpen(this.logger, reqTag, req);
      res.on('finish', () => {
        logHttpSpanClose(this.logger, reqTag, req, res);
      });
      next();
    }
  }

  return DomainSpanMiddleware as Type<NestMiddleware>;
}

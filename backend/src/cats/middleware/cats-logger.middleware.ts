import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const CATS_REQ_LINE =
  '============================================================';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Middleware (미들웨어)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: Express 스타일의 (req, res, next) 함수입니다. 라우팅·Guard보다 일반적으로 더 바깥 단계에서 실행됩니다.
 * - Nest에서는 모듈이 NestModule을 구현하고 configure(consumer)에서 어떤 경로에 적용할지 등록합니다.
 *
 * Guard / Interceptor 와의 차이
 * - 미들웨어: DI가 제한적일 수 있고, “특정 핸들러”가 아니라 경로 단위에 붙는 경우가 많음.
 * - Guard: 라우트 핸들러 실행 허가, ExecutionContext로 메타데이터 접근.
 * - Interceptor: Observable로 핸들러 전후 래핑.
 *
 * 반드시 next()를 호출해야 다음 미들웨어/라우터로 요청이 넘어갑니다.
 *
 * 학습용: 요청 시작 시·응답 완료 시(res.finish) 구분선으로 한 번의 cats 요청 로그 묶음을 구분합니다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Injectable()
export class CatsLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('CatsLoggerMiddleware');

  use(req: Request, res: Response, next: NextFunction) {
    this.logger.warn(CATS_REQ_LINE);
    this.logger.warn(
      `[CATS REQ START] ${req.method} ${req.originalUrl} — 아래부터 이 요청의 파이프라인 로그`,
    );
    this.logger.warn(CATS_REQ_LINE);

    this.logger.log(
      `[CATS-01-MW] 요청 진입 | ${req.method} ${req.originalUrl} | 다음: 라우팅→Guard/Interceptor/Pipe`,
    );

    res.on('finish', () => {
      this.logger.warn(CATS_REQ_LINE);
      this.logger.warn(
        `[CATS REQ END] ${req.method} ${req.originalUrl} | HTTP ${res.statusCode} — 응답 전송 완료`,
      );
      this.logger.warn(CATS_REQ_LINE);
    });

    next();
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * POST/DELETE에서 JwtAuthGuard보다 먼저 실행되어, “가드 체인이 시작됐음”을 로그로 남깁니다.
 */
@Injectable()
export class CatsBeforeJwtLogGuard implements CanActivate {
  private readonly logger = new Logger('CatsGuardBeforeJwt');

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    this.logger.log(
      `[CATS·가드·JWT이전] ${req.method} ${req.originalUrl} │ 다음: Bearer(JWT) 검증`,
    );
    return true;
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Guard (가드) — 참고용 샘플
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 실제 JWT 라우트는 `CatsJwtLogGuard` 등을 씁니다. 이 클래스는 **헤더 한 줄로 막는 가드** 패턴 예시입니다.
 * **`GET /cats/_study/guard-sample`** 에만 붙어, Middleware 다음·Interceptor 이전 단계의 Guard만 실험하기 좋습니다.
 * 상세: `REQUEST_FLOW.md`
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Injectable()
export class CatsStudyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.header('x-cats-study');
    if (token === 'yes') {
      return true;
    }
    throw new UnauthorizedException(
      '학습용 Guard: 헤더 x-cats-study: yes 가 필요합니다.',
    );
  }
}

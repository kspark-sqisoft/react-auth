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
 * 실제 Cats API의 POST/DELETE는 `JwtAuthGuard`(Bearer JWT)를 사용합니다.
 * 이 클래스는 “커스텀 헤더만으로 막는 가드” 패턴을 남겨 둔 예시입니다.
 * 모듈에 등록하지 않으면 라우트에 적용되지 않습니다.
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

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * JwtAuthGuard 통과 후에만 실행됩니다(비로그인·토큰 무효면 여기까지 오지 않음).
 */
@Injectable()
export class CatsAfterJwtLogGuard implements CanActivate {
  private readonly logger = new Logger('CatsGuardAfterJwt');

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as Request & { user?: { sub?: number } }).user;
    this.logger.log(
      `[CATS-04-G2] Guard 뒤 | JWT 통과 user.sub=${user?.sub ?? '?'} | 다음: 05-IXIN→Pipe→CTRL`,
    );
    return true;
  }
}

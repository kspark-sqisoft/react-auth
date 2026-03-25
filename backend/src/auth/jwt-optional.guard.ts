import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Bearer가 없으면 통과, 있으면 JWT 검증.
 * 실패 시에도 목록/상세는 200으로 내려가고 `likedByMe`는 false로 처리.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers?: { authorization?: string };
    }>();
    const auth = req.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return true;
    }
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return true;
    }
  }

  override handleRequest<TUser>(
    err: Error | undefined,
    user: TUser,
    _info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser | undefined {
    if (err || !user) return undefined;
    return user;
  }
}

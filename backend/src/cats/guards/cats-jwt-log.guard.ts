import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';

/**
 * JwtAuthGuard와 동일 + 학습용 로그(③).
 * 실패 시 Passport가 401을 던지며, CatsAfterJwtLogGuard·Pipe·Controller는 실행되지 않습니다.
 */
@Injectable()
export class CatsJwtLogGuard extends JwtAuthGuard {
  private readonly logger = new Logger('CatsGuardJwt');

  canActivate(context: ExecutionContext) {
    this.logger.log(
      `[CATS-03-GJWT] JwtAuthGuard | Bearer 검증 시도 | 실패 시 401·이후 단계 생략`,
    );
    return super.canActivate(context);
  }
}

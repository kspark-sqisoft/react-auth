import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';
import type { Request } from 'express';

const decoratorLog = new Logger('CatsParamDecorator');

/** @CatsClientMeta() 가 주입하는 객체 타입 */
export type CatsClientSnapshot = {
  ip: string | undefined;
  userAgent: string | undefined;
};

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Custom Parameter Decorator (커스텀 파라미터 데코레이터)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: createParamDecorator로 “핸들러의 특정 인자”를 채우는 규칙을 정의합니다.
 * - 팩토리 함수의 두 번째 인자 ExecutionContext에서 HTTP 요청·응답·핸들러 메타데이터 등에 접근합니다.
 * - @Req() req 전체를 넘기지 않고, 필요한 필드만 꺼내 타입 안전하게 쓰고 싶을 때 유용합니다.
 *
 * (참고) 메서드/클래스 데코레이터와 다름: SetMetadata + Reflector는 “메타데이터 부착”, 이건 “인자 주입”.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export const CatsClientMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CatsClientSnapshot => {
    decoratorLog.log(
      `[CATS·데코레이터·파라미터] CatsClientMeta → meta 객체 주입`,
    );
    const req = ctx.switchToHttp().getRequest<Request>();
    return {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
  },
);

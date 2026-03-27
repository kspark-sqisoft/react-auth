import { UnauthorizedException } from '@nestjs/common';

/**
 * JWT `sub`는 라이브러리/직렬화에 따라 문자열로 올 수 있음.
 * DB 사용자 id(숫자)와 비교·저장 전에 항상 숫자로 맞춤.
 */
export function parseJwtSubToUserId(sub: unknown): number | null {
  const n =
    typeof sub === 'string'
      ? parseInt(sub, 10)
      : typeof sub === 'number'
        ? sub
        : NaN;
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function assertJwtSubToUserId(sub: unknown): number {
  const n = parseJwtSubToUserId(sub);
  if (n == null) throw new UnauthorizedException();
  return n;
}

import { join } from 'path';
import type { StringValue } from 'ms';

function positiveInt(v: string | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const PORT = positiveInt(process.env.PORT, 3000);

export const DATABASE_PATH = process.env.DATABASE_PATH ?? 'db.sqlite';

/** 업로드 파일 루트 (절대 또는 cwd 기준). 정적 제공: /uploads → 이 디렉터리 */
export const UPLOAD_ROOT =
  process.env.UPLOAD_ROOT?.trim() || join(process.cwd(), 'uploads');

/** 글 이미지 하위 폴더명 (UPLOAD_ROOT 아래) */
export const POST_IMAGES_SUBDIR = 'posts';

/** 프로필 이미지 하위 폴더명 (UPLOAD_ROOT 아래) */
export const AVATARS_SUBDIR = 'avatars';

export const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';

export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';

export const JWT_ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ??
  '15m') as StringValue;

export const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ??
  '7d') as StringValue;

export const REFRESH_TOKEN_COOKIE =
  process.env.REFRESH_TOKEN_COOKIE ?? 'refresh_token';

/** 리프레시 JWT 만료와 맞추는 것이 좋습니다 (밀리초). */
export const REFRESH_TOKEN_MAX_AGE_MS = positiveInt(
  process.env.REFRESH_COOKIE_MAX_AGE_MS,
  7 * 24 * 60 * 60 * 1000,
);

export function corsOrigin(): true | string | string[] {
  const v = process.env.FRONTEND_ORIGIN?.trim();
  if (!v) return true;
  if (v.includes(',')) return v.split(',').map((s) => s.trim());
  return v;
}

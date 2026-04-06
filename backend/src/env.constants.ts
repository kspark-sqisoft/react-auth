import { join } from 'path';
import type { StringValue } from 'ms';

function positiveInt(v: string | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const PORT = positiveInt(process.env.PORT, 3000);

/** PostgreSQL (로컬·Docker 공통). `docker-compose*.yml` 기본값과 맞춤 */
export const DB_HOST = process.env.DB_HOST?.trim() || 'localhost';
export const DB_PORT = positiveInt(process.env.DB_PORT, 5432);
export const DB_USERNAME = process.env.DB_USERNAME?.trim() || 'reactauth';
export const DB_PASSWORD = process.env.DB_PASSWORD?.trim() || 'reactauth';
export const DB_NAME = process.env.DB_NAME?.trim() || 'reactauth';

/**
 * 스키마 자동 동기화. 운영에서는 `TYPEORM_SYNC=false` + 마이그레이션 권장.
 * 미설정 시: NODE_ENV=production 이면 false, 아니면 true.
 */
export const TYPEORM_SYNCHRONIZE = (() => {
  const v = process.env.TYPEORM_SYNC?.trim().toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return process.env.NODE_ENV !== 'production';
})();

export const TYPEORM_LOGGING = process.env.TYPEORM_LOGGING === 'true';

/** 업로드 파일 루트 (절대 또는 cwd 기준). 정적 제공: /uploads → 이 디렉터리 */
export const UPLOAD_ROOT =
  process.env.UPLOAD_ROOT?.trim() || join(process.cwd(), 'uploads');

/** 글 이미지 하위 폴더명 (UPLOAD_ROOT 아래) */
export const POST_IMAGES_SUBDIR = 'posts';

/** 글 동영상 하위 폴더명 */
export const POST_VIDEOS_SUBDIR = 'post-videos';

/** 글 동영상 썸네일(포스터) 하위 폴더명 */
export const POST_VIDEO_POSTERS_SUBDIR = 'post-video-posters';

/** 프로필 이미지 하위 폴더명 (UPLOAD_ROOT 아래) */
export const AVATARS_SUBDIR = 'avatars';

/** 북(슬라이드) 이미지 */
export const BOOK_IMAGES_SUBDIR = 'book-images';

/** 북 동영상 */
export const BOOK_VIDEOS_SUBDIR = 'book-videos';

/** 북 동영상 포스터 */
export const BOOK_VIDEO_POSTERS_SUBDIR = 'book-video-posters';

/** Cats(학습) 고양이 사진 */
export const CAT_IMAGES_SUBDIR = 'cat-images';

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

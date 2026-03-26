import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import {
  POST_IMAGES_SUBDIR,
  POST_VIDEO_POSTERS_SUBDIR,
  POST_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from '../env.constants';

/** 이미지 필드(image)용 — 컨트롤러에서 업로드 후 크기 재검증 권장 */
export const POST_MEDIA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const POST_MEDIA_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const POST_MEDIA_POSTER_MAX_BYTES = 2 * 1024 * 1024;

const imageMime = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const videoMime = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const posterMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function postMediaMulterOptions() {
  const dirs = {
    image: join(UPLOAD_ROOT, POST_IMAGES_SUBDIR),
    video: join(UPLOAD_ROOT, POST_VIDEOS_SUBDIR),
    videoPoster: join(UPLOAD_ROOT, POST_VIDEO_POSTERS_SUBDIR),
  };
  for (const p of Object.values(dirs)) {
    mkdirSync(p, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: (_req, file, cb) => {
        if (file.fieldname === 'image') cb(null, dirs.image);
        else if (file.fieldname === 'video') cb(null, dirs.video);
        else if (file.fieldname === 'videoPoster') cb(null, dirs.videoPoster);
        else cb(new BadRequestException('지원하지 않는 파일 필드입니다.'), '');
      },
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const fallback =
          file.fieldname === 'video'
            ? '.mp4'
            : file.fieldname === 'videoPoster'
              ? '.jpg'
              : '.jpg';
        cb(null, `${randomUUID()}${ext || fallback}`);
      },
    }),
    limits: { fileSize: POST_MEDIA_VIDEO_MAX_BYTES },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (file.fieldname === 'image') {
        if (!imageMime.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              '이미지는 JPEG, PNG, GIF, WebP만 업로드할 수 있습니다.',
            ),
            false,
          );
        }
        return cb(null, true);
      }
      if (file.fieldname === 'video') {
        if (!videoMime.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              '동영상은 MP4, WebM, QuickTime(MOV)만 업로드할 수 있습니다.',
            ),
            false,
          );
        }
        return cb(null, true);
      }
      if (file.fieldname === 'videoPoster') {
        if (!posterMime.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              '동영상 썸네일은 JPEG, PNG, WebP만 가능합니다.',
            ),
            false,
          );
        }
        return cb(null, true);
      }
      return cb(new BadRequestException('알 수 없는 파일 필드입니다.'), false);
    },
  };
}

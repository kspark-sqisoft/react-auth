import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import {
  BOOK_IMAGES_SUBDIR,
  BOOK_VIDEO_POSTERS_SUBDIR,
  BOOK_VIDEOS_SUBDIR,
  UPLOAD_ROOT,
} from '../env.constants';

export const BOOK_MEDIA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BOOK_MEDIA_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const BOOK_MEDIA_POSTER_MAX_BYTES = 2 * 1024 * 1024;

const imageMime = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const videoMime = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const posterMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function bookMediaMulterOptions() {
  const dirs = {
    image: join(UPLOAD_ROOT, BOOK_IMAGES_SUBDIR),
    video: join(UPLOAD_ROOT, BOOK_VIDEOS_SUBDIR),
    poster: join(UPLOAD_ROOT, BOOK_VIDEO_POSTERS_SUBDIR),
  };
  for (const p of Object.values(dirs)) {
    mkdirSync(p, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: (_req, file, cb) => {
        if (file.fieldname === 'file') {
          const isVid = videoMime.has(file.mimetype);
          cb(null, isVid ? dirs.video : dirs.image);
          return;
        }
        if (file.fieldname === 'poster') {
          cb(null, dirs.poster);
          return;
        }
        cb(new BadRequestException('지원하지 않는 파일 필드입니다.'), '');
      },
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const fallback = file.fieldname === 'poster' ? '.jpg' : '.jpg';
        cb(null, `${randomUUID()}${ext || fallback}`);
      },
    }),
    limits: { fileSize: BOOK_MEDIA_VIDEO_MAX_BYTES },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (file.fieldname === 'file') {
        if (imageMime.has(file.mimetype) || videoMime.has(file.mimetype)) {
          return cb(null, true);
        }
        return cb(
          new BadRequestException(
            '파일은 이미지(JPEG, PNG, GIF, WebP) 또는 동영상(MP4, WebM, MOV)이어야 합니다.',
          ),
          false,
        );
      }
      if (file.fieldname === 'poster') {
        if (!posterMime.has(file.mimetype)) {
          return cb(
            new BadRequestException('포스터는 JPEG, PNG, WebP만 가능합니다.'),
            false,
          );
        }
        return cb(null, true);
      }
      return cb(new BadRequestException('알 수 없는 파일 필드입니다.'), false);
    },
  };
}

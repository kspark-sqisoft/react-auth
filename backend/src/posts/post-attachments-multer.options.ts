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

const POST_MEDIA_VIDEO_MAX_BYTES = 80 * 1024 * 1024;
export const POST_ATTACHMENTS_MAX_COUNT = 20;

const imageMime = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const videoMime = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const posterMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** attachments / newFiles / posters 필드용 */
export function postAttachmentsMulterOptions() {
  const dirs = {
    image: join(UPLOAD_ROOT, POST_IMAGES_SUBDIR),
    video: join(UPLOAD_ROOT, POST_VIDEOS_SUBDIR),
    poster: join(UPLOAD_ROOT, POST_VIDEO_POSTERS_SUBDIR),
  };
  for (const p of Object.values(dirs)) {
    mkdirSync(p, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: (_req, file, cb) => {
        if (file.fieldname === 'posters' || file.fieldname === 'newPosters') {
          return cb(null, dirs.poster);
        }
        if (file.fieldname === 'attachments' || file.fieldname === 'newFiles') {
          if (imageMime.has(file.mimetype)) return cb(null, dirs.image);
          if (videoMime.has(file.mimetype)) return cb(null, dirs.video);
          return cb(
            new BadRequestException(
              '첨부는 JPEG, PNG, GIF, WebP 이미지 또는 MP4, WebM, MOV 동영상만 가능합니다.',
            ),
            '',
          );
        }
        return cb(
          new BadRequestException('지원하지 않는 파일 필드입니다.'),
          '',
        );
      },
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const isPoster =
          file.fieldname === 'posters' || file.fieldname === 'newPosters';
        const fallback = isPoster
          ? '.jpg'
          : videoMime.has(file.mimetype)
            ? '.mp4'
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
      if (file.fieldname === 'posters' || file.fieldname === 'newPosters') {
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
      if (file.fieldname === 'attachments' || file.fieldname === 'newFiles') {
        if (imageMime.has(file.mimetype) || videoMime.has(file.mimetype)) {
          return cb(null, true);
        }
        return cb(
          new BadRequestException(
            '첨부는 이미지(JPEG/PNG/GIF/WebP) 또는 동영상(MP4/WebM/MOV)만 가능합니다.',
          ),
          false,
        );
      }
      return cb(new BadRequestException('알 수 없는 파일 필드입니다.'), false);
    },
  };
}

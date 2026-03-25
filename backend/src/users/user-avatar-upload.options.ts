import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { AVATARS_SUBDIR, UPLOAD_ROOT } from '../env.constants';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export function userAvatarMulterOptions() {
  const dest = join(UPLOAD_ROOT, AVATARS_SUBDIR);
  mkdirSync(dest, { recursive: true });

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, dest),
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: AVATAR_MAX_BYTES },
    fileFilter: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      if (!allowedMime.has(file.mimetype)) {
        return cb(
          new BadRequestException(
            '프로필 이미지는 JPEG, PNG, GIF, WebP만 업로드할 수 있습니다.',
          ),
          false,
        );
      }
      cb(null, true);
    },
  };
}

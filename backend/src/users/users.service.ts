import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AVATARS_SUBDIR, UPLOAD_ROOT } from '../env.constants';
import { User } from './user.entity';

export type MePublic = {
  sub: number;
  email: string;
  name: string;
  imageUrl: string | null;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger('UsersService');

  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  private avatarPublicUrl(filename: string | null): string | null {
    if (!filename) return null;
    return `/uploads/${AVATARS_SUBDIR}/${filename}`;
  }

  private async unlinkAvatar(filename: string | null): Promise<void> {
    if (!filename) return;
    const full = join(UPLOAD_ROOT, AVATARS_SUBDIR, filename);
    if (existsSync(full)) {
      await unlink(full);
    }
  }

  toMePublic(user: User): MePublic {
    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      imageUrl: this.avatarPublicUrl(user.profileImageFilename),
    };
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async findByIdOrFail(id: number): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException();
    }
    return user;
  }

  create(email: string, password: string, name: string) {
    this.logger.log(`[USERS·서비스] create | email=${email}`);
    const user = this.repo.create({ email, password, name: name.trim() });
    return this.repo.save(user);
  }

  async getMeProfile(userId: number): Promise<MePublic> {
    this.logger.log(`[USERS·서비스] getMeProfile | userId=${userId}`);
    const user = await this.findByIdOrFail(userId);
    return this.toMePublic(user);
  }

  async updateMyProfile(
    userId: number,
    body: {
      newImageFilename?: string;
      removeImage?: boolean;
      /** trim된 표시 이름(비어 있으면 호출부에서 넘기지 않음) */
      name?: string;
    },
  ): Promise<MePublic> {
    const user = await this.findByIdOrFail(userId);
    let touched = false;

    if (body.name !== undefined) {
      const n = body.name.trim();
      if (!n) {
        throw new BadRequestException('이름은 비울 수 없습니다.');
      }
      if (n.length > 100) {
        throw new BadRequestException('이름은 100자 이하로 입력해 주세요.');
      }
      user.name = n;
      touched = true;
    }

    if (body.newImageFilename) {
      await this.unlinkAvatar(user.profileImageFilename);
      user.profileImageFilename = body.newImageFilename;
      touched = true;
    } else if (body.removeImage) {
      await this.unlinkAvatar(user.profileImageFilename);
      user.profileImageFilename = null;
      touched = true;
    }

    if (!touched) {
      throw new BadRequestException('변경할 내용이 없습니다.');
    }

    await this.repo.save(user);
    this.logger.log(`[USERS·서비스] updateMyProfile 완료 | userId=${userId}`);
    return this.toMePublic(user);
  }
}

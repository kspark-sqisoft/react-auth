import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
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
    const user = this.repo.create({ email, password, name: name.trim() });
    return this.repo.save(user);
  }

  async getMeProfile(userId: number): Promise<MePublic> {
    const user = await this.findByIdOrFail(userId);
    return this.toMePublic(user);
  }

  async updateMyProfile(
    userId: number,
    body: { newImageFilename?: string; removeImage?: boolean },
  ): Promise<MePublic> {
    const user = await this.findByIdOrFail(userId);

    if (body.newImageFilename) {
      await this.unlinkAvatar(user.profileImageFilename);
      user.profileImageFilename = body.newImageFilename;
    } else if (body.removeImage) {
      await this.unlinkAvatar(user.profileImageFilename);
      user.profileImageFilename = null;
    }

    await this.repo.save(user);
    return this.toMePublic(user);
  }
}

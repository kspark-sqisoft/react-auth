import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AVATARS_SUBDIR,
  BOOTSTRAP_ADMIN_EMAILS,
  UPLOAD_ROOT,
} from '../env.constants';
import { User } from './user.entity';
import { UserRole } from './user-role';

export type MePublic = {
  sub: number;
  email: string;
  name: string;
  imageUrl: string | null;
  role: UserRole;
};

/** 관리자 set-role API 응답(비밀번호 제외) */
export type AdminSetRoleResult = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};

/** 관리자 목록 API(비밀번호 제외) */
export type AdminUserListItem = {
  id: number;
  email: string;
  name: string;
  /** `/uploads/avatars/...` 또는 null */
  imageUrl: string | null;
  role: UserRole;
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
      role: user.role ?? UserRole.User,
    };
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  /** JWT 검증용(삭제된 사용자면 null) */
  async findByIdForAuth(
    id: number,
  ): Promise<Pick<User, 'id' | 'email' | 'name' | 'role'> | null> {
    return this.repo.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
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
    const user = this.repo.create({
      email,
      password,
      name: name.trim(),
      role: UserRole.User,
    });
    return this.repo.save(user);
  }

  /** 관리자를 일반 사용자로 내릴 때 시스템에 관리자가 한 명뿐이면 거절 */
  private async assertNotLastAdminWhenDemotingAdmin(
    userId: number,
  ): Promise<void> {
    const row = await this.repo.findOne({ where: { id: userId } });
    if (!row || row.role !== UserRole.Admin) return;
    const adminCount = await this.repo.count({
      where: { role: UserRole.Admin },
    });
    if (adminCount <= 1) {
      throw new BadRequestException(
        '마지막 관리자입니다. 역할을 일반 사용자로 바꿀 수 없습니다.',
      );
    }
  }

  /**
   * 관리자 전용: 이메일(대소문자 무시)로 사용자를 찾아 역할을 DB에 저장합니다.
   */
  /**
   * 관리자 전용: 전체 사용자 요약 목록(역할 관리 UI용).
   * `find({ select: … })`·raw SQL은 Postgres camelCase 컬럼과 pg 드라이버 키 때문에
   * `profileImageFilename`이 비는 경우가 있어, `getMe`와 같이 전체 엔티티를 읽습니다.
   * (응답 JSON에는 비밀번호를 넣지 않음; 메모리에만 잠시 적재됩니다.)
   */
  async listUsersForAdmin(): Promise<AdminUserListItem[]> {
    const rows = await this.repo.find({
      order: { id: 'ASC' },
    });
    return rows.map((u) => {
      const fn = u.profileImageFilename;
      const trimmed =
        fn != null && String(fn).trim() !== '' ? String(fn).trim() : null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        imageUrl: this.avatarPublicUrl(trimmed),
        role: u.role ?? UserRole.User,
      };
    });
  }

  async setRoleByEmail(
    rawEmail: string,
    newRole: UserRole,
  ): Promise<AdminSetRoleResult> {
    const normalized = rawEmail.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('email이 필요합니다.');
    }
    if (newRole !== UserRole.User && newRole !== UserRole.Admin) {
      throw new BadRequestException('role은 user 또는 admin 이어야 합니다.');
    }

    const target = await this.repo
      .createQueryBuilder('u')
      .where('LOWER(TRIM(u.email)) = :email', { email: normalized })
      .getOne();

    if (!target) {
      throw new NotFoundException('해당 이메일의 사용자를 찾을 수 없습니다.');
    }

    if (target.role === newRole) {
      return {
        id: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
      };
    }

    if (target.role === UserRole.Admin && newRole === UserRole.User) {
      await this.assertNotLastAdminWhenDemotingAdmin(target.id);
    }

    target.role = newRole;
    await this.repo.save(target);
    this.logger.log(
      `[USERS·서비스] admin setRole | userId=${target.id} → ${newRole}`,
    );
    return {
      id: target.id,
      email: target.email,
      name: target.name,
      role: target.role,
    };
  }

  /**
   * `role` 컬럼이 나중에 붙었거나 동기화 이슈로 NULL/빈 문자열인 행을 `user`로 맞춥니다.
   * (엔티티 default는 신규 INSERT에만 적용되는 경우가 많음)
   */
  async ensureUserRoleDefaults(): Promise<void> {
    const result = await this.repo
      .createQueryBuilder()
      .update(User)
      .set({ role: UserRole.User })
      .where('role IS NULL OR TRIM(role) = :empty', { empty: '' })
      .execute();
    const n = result.affected ?? 0;
    if (n > 0) {
      this.logger.warn(
        `[USERS·서비스] role 비어 있는 계정을 user로 보정 | ${n}행`,
      );
    }
  }

  /** (선택) 부팅 시 `BOOTSTRAP_ADMIN_EMAILS`에 해당하는 계정을 admin으로 설정 */
  async ensureBootstrapAdminRoles(): Promise<void> {
    const emails = BOOTSTRAP_ADMIN_EMAILS;
    if (emails.length === 0) return;
    const result = await this.repo
      .createQueryBuilder()
      .update(User)
      .set({ role: UserRole.Admin })
      .where('LOWER(email) IN (:...emails)', { emails })
      .execute();
    const n = result.affected ?? 0;
    if (n > 0) {
      this.logger.log(
        `[USERS·서비스] bootstrap admin 적용 | 대상 이메일 수=${emails.length} 갱신 행=${n}`,
      );
    }
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
      /** trim된 표시 이름(비어 있으면 호출부에서 넘지 않음) */
      name?: string;
      /** 역할 변경 요청(검증 후 반영) */
      role?: UserRole;
    },
  ): Promise<MePublic> {
    const user = await this.findByIdOrFail(userId);
    let touched = false;

    if (body.role !== undefined) {
      if (body.role === UserRole.Admin) {
        if (user.role !== UserRole.Admin) {
          throw new ForbiddenException(
            '본인을 관리자로 올리려면 다른 관리자가 내 정보의 «다른 사용자 역할»에서 지정해야 합니다.',
          );
        }
      } else if (body.role === UserRole.User) {
        if (user.role === UserRole.Admin) {
          await this.assertNotLastAdminWhenDemotingAdmin(user.id);
          user.role = UserRole.User;
          touched = true;
        }
      }
    }

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
      if (body.role !== undefined) {
        return this.toMePublic(user);
      }
      throw new BadRequestException('변경할 내용이 없습니다.');
    }

    await this.repo.save(user);
    this.logger.log(`[USERS·서비스] updateMyProfile 완료 | userId=${userId}`);
    return this.toMePublic(user);
  }
}

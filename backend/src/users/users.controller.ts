import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersDomainSpanInterceptor } from './users-domain-span';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { AdminSetRoleDto } from './dto/admin-set-role.dto';
import { PatchMeDto } from './dto/patch-me.dto';
import { userAvatarMulterOptions } from './user-avatar-upload.options';
import { UserRole } from './user-role';
import {
  type AdminSetRoleResult,
  type AdminUserListItem,
  type MePublic,
  UsersService,
} from './users.service';

const multipartMePatchBody = {
  schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '표시 이름(1~100자, 공백만은 불가)',
      },
      removeImage: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '기존 프로필 이미지 제거(새 파일 없을 때)',
      },
      image: {
        type: 'string',
        format: 'binary',
        description: '프로필 이미지(JPEG/PNG/GIF/WebP, 최대 2MB)',
      },
      role: {
        type: 'string',
        enum: ['user', 'admin'],
        description:
          '역할(선택). 본인을 admin으로 올리기 불가(다른 관리자가 목록·admin/set-role 사용). admin→user 강등 가능.',
      },
    },
  },
};

const PATCH_ME_ROLE_BY_NORMALIZED: Record<string, UserRole> = {
  [UserRole.Admin]: UserRole.Admin,
  [UserRole.User]: UserRole.User,
};

function parsePatchMeRole(raw: string | undefined): UserRole | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = raw.trim().toLowerCase();
  if (t === '') return undefined;
  const role = PATCH_ME_ROLE_BY_NORMALIZED[t];
  if (role !== undefined) return role;
  throw new BadRequestException('role은 user 또는 admin 이어야 합니다.');
}

@ApiTags('users')
@Controller('users')
@UseInterceptors(UsersDomainSpanInterceptor)
export class UsersController {
  private readonly logger = new Logger('UsersController');

  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @ApiOperation({
    summary: '내 프로필(sub·이메일·이름·역할·프로필 이미지 URL)',
  })
  async getMe(@Req() req: Request & { user: JwtPayload }): Promise<MePublic> {
    this.logger.log('[USERS·컨트롤러] getMe() 핸들러 진입');
    const me: MePublic = await this.usersService.getMeProfile(req.user.sub);
    this.logger.log(
      `[USERS·컨트롤러] getMe 응답 | sub=${me.sub} email=${me.email} name=${me.name}`,
    );
    return me;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiBearerAuth('JWT-auth')
  @Get('admin')
  @ApiOperation({
    summary: '관리자: 전체 사용자 목록(이메일·이름·역할)',
    description:
      '비밀번호는 포함하지 않습니다. 내 정보 화면에서 다른 계정 역할을 바꿀 때 사용합니다.',
  })
  async adminListUsers(): Promise<AdminUserListItem[]> {
    this.logger.log('[USERS·컨트롤러] adminListUsers() 진입');
    return this.usersService.listUsersForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin)
  @ApiBearerAuth('JWT-auth')
  @Post('admin/set-role')
  @ApiOperation({
    summary: '관리자: 이메일로 계정 역할 지정',
    description:
      'DB에 저장됩니다. 마지막 관리자를 일반 사용자로 내리는 것은 불가합니다.',
  })
  @ApiBody({ type: AdminSetRoleDto })
  async adminSetRole(
    @Body() body: AdminSetRoleDto,
  ): Promise<AdminSetRoleResult> {
    this.logger.log('[USERS·컨트롤러] adminSetRole() 진입');
    if (body.role !== UserRole.User && body.role !== UserRole.Admin) {
      throw new BadRequestException('role은 user 또는 admin 이어야 합니다.');
    }
    return this.usersService.setRoleByEmail(body.email ?? '', body.role);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartMePatchBody)
  @UseInterceptors(FileInterceptor('image', userAvatarMulterOptions()))
  @Patch('me')
  @ApiOperation({
    summary: '내 프로필(이름·이미지·역할) 변경 또는 이미지 제거',
  })
  async patchMe(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: PatchMeDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MePublic> {
    const { removeImage, name: nameRaw, role: roleRaw } = body;
    const remove =
      !file &&
      (removeImage === '1' || removeImage === 'true' || removeImage === 'on');
    const nameTrimmed = typeof nameRaw === 'string' ? nameRaw.trim() : '';
    const hasName = nameTrimmed.length > 0;
    const roleParsed = parsePatchMeRole(
      typeof roleRaw === 'string' ? roleRaw : undefined,
    );
    const hasRole = roleParsed !== undefined;

    if (!file && !remove && !hasName && !hasRole) {
      throw new BadRequestException(
        '이름·역할을 바꾸거나, 프로필 이미지를 선택·제거해 주세요.',
      );
    }

    const me: MePublic = await this.usersService.updateMyProfile(req.user.sub, {
      newImageFilename: file?.filename,
      removeImage: remove,
      ...(hasName ? { name: nameTrimmed } : {}),
      ...(hasRole ? { role: roleParsed } : {}),
    });
    this.logger.log(`[USERS·컨트롤러] patchMe 완료 | sub=${me.sub}`);
    return me;
  }
}

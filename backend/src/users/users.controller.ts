import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Patch,
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
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { PatchMeDto } from './dto/patch-me.dto';
import { userAvatarMulterOptions } from './user-avatar-upload.options';
import { type MePublic, UsersService } from './users.service';

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
    },
  },
};

@ApiTags('users')
@Controller('users')
@UseInterceptors(UsersDomainSpanInterceptor)
export class UsersController {
  private readonly logger = new Logger('UsersController');

  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @ApiOperation({ summary: '내 프로필(sub·이메일·이름·프로필 이미지 URL)' })
  async getMe(@Req() req: Request & { user: JwtPayload }): Promise<MePublic> {
    this.logger.log('[USERS·컨트롤러] getMe() 핸들러 진입');
    const me: MePublic = await this.usersService.getMeProfile(req.user.sub);
    this.logger.log(
      `[USERS·컨트롤러] getMe 응답 | sub=${me.sub} email=${me.email} name=${me.name}`,
    );
    return me;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartMePatchBody)
  @UseInterceptors(FileInterceptor('image', userAvatarMulterOptions()))
  @Patch('me')
  @ApiOperation({ summary: '내 프로필(이름·이미지) 변경 또는 이미지 제거' })
  async patchMe(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: PatchMeDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MePublic> {
    const { removeImage, name: nameRaw } = body;
    const remove =
      !file &&
      (removeImage === '1' || removeImage === 'true' || removeImage === 'on');
    const nameTrimmed = typeof nameRaw === 'string' ? nameRaw.trim() : '';
    const hasName = nameTrimmed.length > 0;

    if (!file && !remove && !hasName) {
      throw new BadRequestException(
        '이름을 입력하거나, 프로필 이미지를 선택·제거해 주세요.',
      );
    }

    const me: MePublic = await this.usersService.updateMyProfile(req.user.sub, {
      newImageFilename: file?.filename,
      removeImage: remove,
      ...(hasName ? { name: nameTrimmed } : {}),
    });
    this.logger.log(`[USERS·컨트롤러] patchMe 완료 | sub=${me.sub}`);
    return me;
  }
}

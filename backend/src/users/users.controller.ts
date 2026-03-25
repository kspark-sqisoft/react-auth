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
import { userAvatarMulterOptions } from './user-avatar-upload.options';
import { type MePublic, UsersService } from './users.service';

const multipartMePatchBody = {
  schema: {
    type: 'object',
    properties: {
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
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @ApiOperation({ summary: '내 프로필(sub·이메일·이름·프로필 이미지 URL)' })
  async getMe(@Req() req: Request & { user: JwtPayload }): Promise<MePublic> {
    const me: MePublic = await this.usersService.getMeProfile(req.user.sub);
    this.logger.log(`[내 정보] 조회 sub=${me.sub} email=${me.email}`);
    return me;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartMePatchBody)
  @UseInterceptors(FileInterceptor('image', userAvatarMulterOptions()))
  @Patch('me')
  @ApiOperation({ summary: '내 프로필 이미지 변경 또는 제거' })
  async patchMe(
    @Req() req: Request & { user: JwtPayload },
    @UploadedFile() file?: Express.Multer.File,
    @Body('removeImage') removeImage?: string,
  ): Promise<MePublic> {
    const remove =
      !file &&
      (removeImage === '1' || removeImage === 'true' || removeImage === 'on');
    if (!file && !remove) {
      throw new BadRequestException(
        '프로필 이미지 파일을 선택하거나, 기존 이미지 제거를 선택해 주세요.',
      );
    }
    const me: MePublic = await this.usersService.updateMyProfile(req.user.sub, {
      newImageFilename: file?.filename,
      removeImage: remove,
    });
    this.logger.log(`[내 정보] 프로필 이미지 갱신 sub=${me.sub}`);
    return me;
  }
}

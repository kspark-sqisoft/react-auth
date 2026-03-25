import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post as PostMethod,
  Query,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { postImageMulterOptions } from './post-image-upload.options';
import { PostsService } from './posts.service';

const multipartPostBody = {
  schema: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', example: '제목' },
      content: { type: 'string', example: '본문' },
      image: {
        type: 'string',
        format: 'binary',
        description: '선택(JPEG/PNG/GIF/WebP)',
      },
    },
  },
};

const multipartPatchBody = {
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      removeImage: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '기존 이미지 제거(새 파일 없을 때)',
      },
      image: { type: 'string', format: 'binary' },
    },
  },
};

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get()
  @ApiOperation({ summary: '글 목록(페이지)' })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({ name: 'take', required: false, example: 4 })
  findPage(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skipRaw: number,
    @Query('take', new DefaultValuePipe(4), ParseIntPipe) takeRaw: number,
  ) {
    const skip = Math.max(0, skipRaw);
    const take = Math.min(50, Math.max(1, takeRaw));
    return this.postsService.findPage(skip, take);
  }

  @Get(':id')
  @ApiOperation({ summary: '글 상세' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartPostBody)
  @UseInterceptors(FileInterceptor('image', postImageMulterOptions()))
  @PostMethod()
  @ApiOperation({ summary: '글 작성' })
  create(
    @Req() req: Request & { user: JwtPayload },
    @Body('title') title: string,
    @Body('content') content: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.postsService.create(req.user.sub, {
      title,
      content,
      imageFilename: file?.filename ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartPatchBody)
  @UseInterceptors(FileInterceptor('image', postImageMulterOptions()))
  @Patch(':id')
  @ApiOperation({ summary: '글 수정(작성자만)' })
  update(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body('title') title?: string,
    @Body('content') content?: string,
    @Body('removeImage') removeImage?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const remove =
      !file &&
      (removeImage === '1' || removeImage === 'true' || removeImage === 'on');
    return this.postsService.update(req.user.sub, id, {
      title,
      content,
      newImageFilename: file?.filename,
      removeImage: remove,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @ApiOperation({ summary: '글 삭제(작성자만)' })
  async remove(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.postsService.remove(req.user.sub, id);
    return { ok: true };
  }
}

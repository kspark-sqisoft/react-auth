import {
  BadRequestException,
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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { unlink } from 'fs/promises';
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
import { OptionalJwtAuthGuard } from '../auth/jwt-optional.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import {
  POST_MEDIA_IMAGE_MAX_BYTES,
  POST_MEDIA_POSTER_MAX_BYTES,
  postMediaMulterOptions,
} from './post-media-upload.options';
import { CommentsService } from './comments.service';
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
        description:
          '선택(JPEG/PNG/GIF/WebP, 최대 5MB). 동영상과 동시에 보낼 수 없습니다.',
      },
      video: {
        type: 'string',
        format: 'binary',
        description:
          '선택(MP4/WebM/MOV, 최대 80MB). 이미지와 동시에 보낼 수 없습니다.',
      },
      videoPoster: {
        type: 'string',
        format: 'binary',
        description: '선택(동영상과 함께; JPEG/PNG/WebP 썸네일, 최대 2MB)',
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
      removeMedia: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '기존 첨부 전부 제거(이미지·동영상·썸네일; 새 파일 없을 때)',
      },
      removeImage: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '호환용: removeMedia와 동일하게 전체 첨부 제거',
      },
      removeVideo: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '호환용: removeMedia와 동일하게 전체 첨부 제거',
      },
      image: { type: 'string', format: 'binary' },
      video: { type: 'string', format: 'binary' },
      videoPoster: { type: 'string', format: 'binary' },
    },
  },
};

async function cleanupPostUploads(
  files: (Express.Multer.File | undefined)[],
): Promise<void> {
  await Promise.all(
    files.filter(Boolean).map((f) => {
      const p = f!.path;
      return p ? unlink(p).catch(() => undefined) : Promise.resolve();
    }),
  );
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private postsService: PostsService,
    private commentsService: CommentsService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: '글 목록(페이지); Bearer 있으면 likedByMe 반영' })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({ name: 'take', required: false, example: 4 })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '제목·본문 부분 일치(공백 제거, 최대 120자)',
  })
  findPage(
    @Req() req: Request & { user?: JwtPayload },
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skipRaw: number,
    @Query('take', new DefaultValuePipe(4), ParseIntPipe) takeRaw: number,
    @Query('search') search?: string,
  ) {
    const skip = Math.max(0, skipRaw);
    const take = Math.min(50, Math.max(1, takeRaw));
    return this.postsService.findPage(skip, take, req.user?.sub, search);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: '글 댓글(계층 트리)' })
  findComments(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.findTreeByPostId(id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: '글 상세; Bearer 있으면 likedByMe 반영' })
  findOne(
    @Req() req: Request & { user?: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.findOne(id, req.user?.sub);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @PostMethod(':id/like')
  @ApiOperation({ summary: '글 좋아요(로그인, 사용자당 글당 1회)' })
  addLike(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.addLike(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id/like')
  @ApiOperation({ summary: '글 좋아요 취소' })
  removeLike(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.removeLike(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @PostMethod(':id/comments')
  @ApiOperation({ summary: '댓글 작성(대댓글은 body.parentId)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string', example: '댓글 내용' },
        parentId: {
          type: 'number',
          nullable: true,
          description: '대댓글일 때 부모 댓글 id',
        },
      },
    },
  })
  createComment(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content?: string; parentId?: number },
  ) {
    return this.commentsService.create(id, req.user.sub, {
      content: body.content ?? '',
      parentId: body.parentId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: '댓글 삭제(작성자만, 하위 대댓글도 함께 삭제)' })
  async removeComment(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    await this.commentsService.remove(id, commentId, req.user.sub);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartPostBody)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 },
        { name: 'videoPoster', maxCount: 1 },
      ],
      postMediaMulterOptions(),
    ),
  )
  @PostMethod()
  @ApiOperation({ summary: '글 작성' })
  async create(
    @Req() req: Request & { user: JwtPayload },
    @Body('title') title: string,
    @Body('content') content: string,
    @UploadedFiles()
    files?: {
      image?: Express.Multer.File[];
      video?: Express.Multer.File[];
      videoPoster?: Express.Multer.File[];
    },
  ) {
    const imageFile = files?.image?.[0];
    const videoFile = files?.video?.[0];
    const posterFile = files?.videoPoster?.[0];

    if (posterFile && !videoFile) {
      await cleanupPostUploads([imageFile, posterFile]);
      throw new BadRequestException(
        '동영상이 없으면 썸네일만 보낼 수 없습니다.',
      );
    }
    if (imageFile && imageFile.size > POST_MEDIA_IMAGE_MAX_BYTES) {
      await cleanupPostUploads([imageFile, videoFile, posterFile]);
      throw new BadRequestException('이미지는 5MB 이하여야 합니다.');
    }
    if (posterFile && posterFile.size > POST_MEDIA_POSTER_MAX_BYTES) {
      await cleanupPostUploads([imageFile, videoFile, posterFile]);
      throw new BadRequestException('동영상 썸네일은 2MB 이하여야 합니다.');
    }
    if (imageFile && videoFile) {
      await cleanupPostUploads([imageFile, videoFile, posterFile]);
      throw new BadRequestException(
        '이미지와 동영상을 동시에 올릴 수 없습니다. 하나만 선택하세요.',
      );
    }

    return this.postsService.create(req.user.sub, {
      title,
      content,
      imageFilename: imageFile?.filename ?? null,
      videoFilename: videoFile?.filename ?? null,
      videoPosterFilename: posterFile?.filename ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartPatchBody)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image', maxCount: 1 },
        { name: 'video', maxCount: 1 },
        { name: 'videoPoster', maxCount: 1 },
      ],
      postMediaMulterOptions(),
    ),
  )
  @Patch(':id')
  @ApiOperation({ summary: '글 수정(작성자만)' })
  async update(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body('title') title?: string,
    @Body('content') content?: string,
    @Body('removeMedia') removeMedia?: string,
    @Body('removeImage') removeImage?: string,
    @Body('removeVideo') removeVideo?: string,
    @UploadedFiles()
    files?: {
      image?: Express.Multer.File[];
      video?: Express.Multer.File[];
      videoPoster?: Express.Multer.File[];
    },
  ) {
    const imageFile = files?.image?.[0];
    const videoFile = files?.video?.[0];
    const posterFile = files?.videoPoster?.[0];

    if (posterFile && !videoFile) {
      await cleanupPostUploads([imageFile, posterFile]);
      throw new BadRequestException(
        '새 동영상 파일과 함께 썸네일을 보내 주세요.',
      );
    }
    if (imageFile && imageFile.size > POST_MEDIA_IMAGE_MAX_BYTES) {
      await cleanupPostUploads([imageFile, videoFile, posterFile]);
      throw new BadRequestException('이미지는 5MB 이하여야 합니다.');
    }
    if (posterFile && posterFile.size > POST_MEDIA_POSTER_MAX_BYTES) {
      await cleanupPostUploads([imageFile, videoFile, posterFile]);
      throw new BadRequestException('동영상 썸네일은 2MB 이하여야 합니다.');
    }
    if (imageFile && videoFile) {
      await cleanupPostUploads([imageFile, videoFile, posterFile]);
      throw new BadRequestException(
        '이미지와 동영상을 동시에 올릴 수 없습니다. 하나만 선택하세요.',
      );
    }

    const truthy = (v: string | undefined) =>
      v === '1' || v === 'true' || v === 'on';
    const clearAllMedia =
      !imageFile &&
      !videoFile &&
      (truthy(removeMedia) || truthy(removeImage) || truthy(removeVideo));

    return this.postsService.update(req.user.sub, id, {
      title,
      content,
      newImageFilename: imageFile?.filename,
      newVideoFilename: videoFile?.filename,
      newVideoPosterFilename: posterFile?.filename,
      clearAllMedia,
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

import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Logger,
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
  POST_ATTACHMENTS_MAX_COUNT,
  postAttachmentsMulterOptions,
} from './post-attachments-multer.options';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostFieldsDto } from './dto/create-post-fields.dto';
import { UpdatePostFieldsDto } from './dto/update-post-fields.dto';
import { PostsService } from './posts.service';
import { PostsDomainSpanInterceptor } from './posts-domain-span';

const multipartPostBody = {
  schema: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', example: '제목' },
      content: { type: 'string', example: '본문' },
      attachments: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description: `순서대로 이미지·동영상 혼합(최대 ${POST_ATTACHMENTS_MAX_COUNT}개)`,
      },
      posters: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description:
          '동영상 순서대로 썸네일(있는 동영상만; JPEG/PNG/WebP, 동영상마다 0~1개)',
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
      mediaPlan: {
        type: 'string',
        description:
          'JSON: {"items":[{"t":"e","id":1},{"t":"n","i":0}]} — 기존(e)·새(n) 순서',
      },
      removeMedia: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '첨부 전부 제거(mediaPlan 없을 때)',
      },
      removeImage: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '호환: removeMedia와 동일',
      },
      removeVideo: {
        type: 'string',
        enum: ['1', 'true', 'on'],
        description: '호환: removeMedia와 동일',
      },
      newFiles: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
      newPosters: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    },
  },
};

async function cleanupUploadedFiles(
  files?: Record<string, Express.Multer.File[]>,
): Promise<void> {
  const list = files ? Object.values(files).flat() : [];
  const tasks = list
    .filter((f): f is Express.Multer.File & { path: string } => Boolean(f.path))
    .map((f) => unlink(f.path).catch(() => undefined));
  await Promise.all(tasks);
}

@ApiTags('posts')
@Controller('posts')
@UseInterceptors(PostsDomainSpanInterceptor)
export class PostsController {
  private readonly logger = new Logger('PostsController');

  constructor(
    private postsService: PostsService,
    private commentsService: CommentsService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({
    summary:
      '글 목록(커서·무한 스크롤); Bearer 있으면 likedByMe 반영. 첫 응답에만 total 포함',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: '이전 응답의 nextCursor(첫 페이지는 생략)',
  })
  @ApiQuery({ name: 'take', required: false, example: 12 })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '제목·본문 부분 일치(공백 제거, 최대 120자)',
  })
  findPage(
    @Req() req: Request & { user?: JwtPayload },
    @Query('take', new DefaultValuePipe(12), ParseIntPipe) takeRaw: number,
    @Query('search') search?: string,
    @Query('cursor') cursor?: string,
  ) {
    this.logger.log('[POSTS·컨트롤러] findPage() 핸들러 진입');
    const take = Math.min(50, Math.max(1, takeRaw));
    const c = cursor?.trim() ? cursor.trim() : undefined;
    return this.postsService.findPage(take, req.user?.sub, search, c);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: '글 댓글(계층 트리)' })
  findComments(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`[POSTS·컨트롤러] findComments(${id}) 핸들러 진입`);
    return this.commentsService.findTreeByPostId(id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: '글 상세; Bearer 있으면 likedByMe 반영' })
  findOne(
    @Req() req: Request & { user?: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.logger.log(`[POSTS·컨트롤러] findOne(${id}) 핸들러 진입`);
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
    this.logger.log(`[POSTS·컨트롤러] removeLike(${id}) 핸들러 진입`);
    return this.postsService.removeLike(req.user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @PostMethod(':id/comments')
  @ApiOperation({ summary: '댓글 작성(대댓글은 body.parentId)' })
  @ApiBody({ type: CreateCommentDto })
  createComment(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateCommentDto,
  ) {
    this.logger.log(`[POSTS·컨트롤러] createComment(post ${id}) 핸들러 진입`);
    return this.commentsService.create(id, req.user.sub, {
      content: body.content ?? '',
      parentId: body.parentId ?? undefined,
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
    this.logger.log(
      `[POSTS·컨트롤러] removeComment(post ${id}, comment ${commentId}) 핸들러 진입`,
    );
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
        { name: 'attachments', maxCount: POST_ATTACHMENTS_MAX_COUNT },
        { name: 'posters', maxCount: POST_ATTACHMENTS_MAX_COUNT },
      ],
      postAttachmentsMulterOptions(),
    ),
  )
  @PostMethod()
  @ApiOperation({ summary: '글 작성' })
  async create(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: CreatePostFieldsDto,
    @UploadedFiles()
    files?: {
      attachments?: Express.Multer.File[];
      posters?: Express.Multer.File[];
    },
  ) {
    const attachmentFiles = files?.attachments ?? [];
    const posterFiles = files?.posters ?? [];

    this.logger.log('[POSTS·컨트롤러] create() 핸들러 진입');
    try {
      return await this.postsService.createWithAttachments(
        req.user.sub,
        body.title,
        body.content,
        attachmentFiles,
        posterFiles,
      );
    } catch (e) {
      await cleanupUploadedFiles(files);
      throw e;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody(multipartPatchBody)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'newFiles', maxCount: POST_ATTACHMENTS_MAX_COUNT },
        { name: 'newPosters', maxCount: POST_ATTACHMENTS_MAX_COUNT },
      ],
      postAttachmentsMulterOptions(),
    ),
  )
  @Patch(':id')
  @ApiOperation({ summary: '글 수정(작성자만)' })
  async update(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePostFieldsDto,
    @UploadedFiles()
    files?: {
      newFiles?: Express.Multer.File[];
      newPosters?: Express.Multer.File[];
    },
  ) {
    const newFiles = files?.newFiles ?? [];
    const newPosters = files?.newPosters ?? [];
    const {
      title,
      content,
      mediaPlan: mediaPlanRaw,
      removeMedia,
      removeImage,
      removeVideo,
    } = body;

    const truthy = (v: string | undefined) =>
      v === '1' || v === 'true' || v === 'on';
    const clearAllMedia =
      newFiles.length === 0 &&
      !mediaPlanRaw?.trim() &&
      (truthy(removeMedia) || truthy(removeImage) || truthy(removeVideo));

    let mediaPlan:
      | Array<{ t: 'e'; id: number } | { t: 'n'; i: number }>
      | undefined;

    if (mediaPlanRaw?.trim()) {
      try {
        const parsed = JSON.parse(mediaPlanRaw) as { items?: unknown };
        if (!parsed.items || !Array.isArray(parsed.items)) {
          throw new BadRequestException('mediaPlan.items 가 필요합니다.');
        }
        mediaPlan = parsed.items.map((x: unknown) => {
          if (!x || typeof x !== 'object') throw new Error();
          const o = x as { t?: string; id?: number; i?: number };
          if (o.t === 'e' && typeof o.id === 'number')
            return { t: 'e', id: o.id };
          if (o.t === 'n' && typeof o.i === 'number') return { t: 'n', i: o.i };
          throw new Error();
        });
      } catch {
        await cleanupUploadedFiles(files);
        throw new BadRequestException(
          'mediaPlan 형식이 올바르지 않습니다. 예: {"items":[{"t":"e","id":1},{"t":"n","i":0}]}',
        );
      }
    }

    try {
      return await this.postsService.updatePost(req.user.sub, id, {
        title,
        content,
        clearAllMedia: clearAllMedia || undefined,
        mediaPlan,
        newFiles,
        newPosters,
      });
    } catch (e) {
      await cleanupUploadedFiles(files);
      throw e;
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @ApiOperation({ summary: '글 삭제(작성자만)' })
  async remove(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.logger.log(`[POSTS·컨트롤러] remove(${id}) 핸들러 진입`);
    await this.postsService.remove(req.user.sub, id);
    return { ok: true };
  }
}

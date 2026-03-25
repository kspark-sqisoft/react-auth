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
import { OptionalJwtAuthGuard } from '../auth/jwt-optional.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { postImageMulterOptions } from './post-image-upload.options';
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

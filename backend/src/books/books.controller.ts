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
  Post,
  Query,
  Logger,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { stat, unlink } from 'fs/promises';
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
import {
  BOOK_MEDIA_POSTER_MAX_BYTES,
  bookMediaMulterOptions,
} from './book-upload.options';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BooksDomainSpanInterceptor } from './books-domain-span';

@ApiTags('books')
@Controller('books')
@UseInterceptors(BooksDomainSpanInterceptor)
export class BooksController {
  private readonly logger = new Logger('BooksController');

  constructor(private booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: '북 목록(페이지)' })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({ name: 'take', required: false, example: 12 })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '제목 부분 일치(최대 120자)',
  })
  findPage(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skipRaw: number,
    @Query('take', new DefaultValuePipe(12), ParseIntPipe) takeRaw: number,
    @Query('search') search?: string,
  ) {
    const skip = Math.max(0, skipRaw);
    const take = Math.min(50, Math.max(1, takeRaw));
    return this.booksService.findPage(skip, take, search);
  }

  @Get(':id')
  @ApiOperation({ summary: '북 상세(페이지·캔버스 요소 포함)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`[BOOKS-09-CTRL] findOne(${id}) 핸들러 진입`);
    return this.booksService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @ApiOperation({ summary: '북 만들기' })
  @ApiBody({ type: CreateBookDto })
  create(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: CreateBookDto,
  ) {
    return this.booksService.create(req.user.sub, {
      title: body.title ?? '',
      pages: body.pages,
      slideWidth: body.slideWidth,
      slideHeight: body.slideHeight,
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Patch(':id')
  @ApiOperation({ summary: '북 수정(작성자만). pages내면 페이지 전체 교체' })
  @ApiBody({ type: UpdateBookDto })
  update(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBookDto,
  ) {
    this.logger.log(`[BOOKS-09-CTRL] update(${id}) 핸들러 진입`);
    return this.booksService.update(id, req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @ApiOperation({ summary: '북 삭제(작성자만)' })
  async remove(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.logger.log(`[BOOKS-09-CTRL] remove(${id}) 핸들러 진입`);
    await this.booksService.remove(id, req.user.sub);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '이미지 또는 동영상',
        },
        poster: {
          type: 'string',
          format: 'binary',
          description: '동영상 썸네일(선택, JPEG/PNG/WebP)',
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'poster', maxCount: 1 },
      ],
      bookMediaMulterOptions(),
    ),
  )
  @Post(':id/upload')
  @ApiOperation({ summary: '북용 미디어 업로드(작성자만)' })
  async uploadMedia(
    @Req() req: Request & { user: JwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles()
    files?: { file?: Express.Multer.File[]; poster?: Express.Multer.File[] },
  ) {
    this.logger.log(`[BOOKS-09-CTRL] uploadMedia(${id}) 핸들러 진입`);
    await this.booksService.assertBookOwner(id, req.user.sub);
    const file = files?.file?.[0];
    if (!file?.path) {
      throw new BadRequestException('file 필드가 필요합니다.');
    }

    const meta = this.booksService.mapUploadedFile(file);
    let posterUrl: string | null = null;

    if (meta.kind === 'video') {
      const poster = files?.poster?.[0];
      if (poster?.path) {
        const st = await stat(poster.path);
        if (st.size > BOOK_MEDIA_POSTER_MAX_BYTES) {
          await unlink(poster.path).catch(() => undefined);
          throw new BadRequestException(
            `포스터는 ${Math.floor(BOOK_MEDIA_POSTER_MAX_BYTES / (1024 * 1024))}MB 이하여야 합니다.`,
          );
        }
        posterUrl = this.booksService.mapPosterFile(poster);
      }
    } else if (files?.poster?.[0]?.path) {
      await unlink(files.poster[0].path).catch(() => undefined);
    }

    return { ...meta, posterUrl };
  }
}

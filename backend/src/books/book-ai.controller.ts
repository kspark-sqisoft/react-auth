import {
  Body,
  Controller,
  Get,
  Logger,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { BooksDomainSpanInterceptor } from './books-domain-span';
import { BookAiService } from './book-ai.service';

class BookLayoutAiSelectionDto {
  /** 캔버스에서 단일 선택된 이미지·비디오 위젯 id */
  elementId!: string;
  kind!: 'image' | 'video';
}

class BookLayoutAiBodyDto {
  message!: string;
  slideWidth!: number;
  slideHeight!: number;
  /** 전체 슬라이드(페이지) 수, 1~500 */
  pageCount!: number;
  /** 현재 보고 있는 슬라이드 인덱스, 0-based */
  activeSlideIndex!: number;
  /** 단일 이미지/비디오 선택 시에만 — 교체·바꿔줘 요청에 replace_widget_media로 연결 */
  selection?: BookLayoutAiSelectionDto;
  /**
   * 저장된 북 id. 넣으면 성공한 user/assistant 한 턴을 DB에 남깁니다(작성자만).
   * OpenAI 요청에는 이전 대화를 넣지 않으므로 토큰 사용은 늘지 않습니다.
   */
  bookId?: number;
}

@ApiTags('books')
@Controller('books/ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(BooksDomainSpanInterceptor)
export class BooksAiController {
  private readonly logger = new Logger(BooksAiController.name);

  constructor(private readonly bookAiService: BookAiService) {}

  @Get('chat')
  @ApiOperation({
    summary: '북 AI 대화 기록',
    description: '해당 북 작성자만. 시간순 최대 200줄.',
  })
  @ApiQuery({ name: 'bookId', required: true, type: Number })
  chatHistory(
    @Req() req: Request & { user: JwtPayload },
    @Query('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.bookAiService.listLayoutChat(bookId, req.user.sub);
  }

  @Post('layout')
  @ApiOperation({
    summary: '북 편집 AI 어시스턴트 (OpenAI)',
    description:
      '로그인 필요. 자연어를 JSON 액션(위젯·이미지·제목·배경 등)으로 해석합니다. `OPENAI_API_KEY` 필요.',
  })
  async layout(
    @Req() req: Request & { user: JwtPayload },
    @Body() body: BookLayoutAiBodyDto,
  ) {
    const result = await this.bookAiService.interpretLayoutIntent({
      message: body.message,
      slideWidth: Number(body.slideWidth),
      slideHeight: Number(body.slideHeight),
      pageCount: Number(body.pageCount),
      activeSlideIndex: Number(body.activeSlideIndex),
      selection:
        body.selection?.elementId &&
        (body.selection.kind === 'image' || body.selection.kind === 'video')
          ? {
              elementId: String(body.selection.elementId).trim().slice(0, 80),
              kind: body.selection.kind,
            }
          : undefined,
    });

    const bid = body.bookId;
    if (bid !== undefined && bid !== null) {
      const id = Math.floor(Number(bid));
      if (Number.isFinite(id) && id > 0) {
        await this.bookAiService
          .tryPersistChatTurn(id, req.user.sub, body.message, result.reply)
          .catch((e) => {
            this.logger.warn(
              `[books/ai] 대화 저장 생략 bookId=${id}: ${String(e)}`,
            );
          });
      }
    }

    return result;
  }
}

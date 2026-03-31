import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
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
}

@ApiTags('books')
@Controller('books/ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@UseInterceptors(BooksDomainSpanInterceptor)
export class BooksAiController {
  constructor(private readonly bookAiService: BookAiService) {}

  @Post('layout')
  @ApiOperation({
    summary: '북 편집 AI 어시스턴트 (OpenAI)',
    description:
      '로그인 필요. 자연어를 JSON 액션(위젯·이미지·제목·배경 등)으로 해석합니다. `OPENAI_API_KEY` 필요.',
  })
  layout(@Body() body: BookLayoutAiBodyDto) {
    return this.bookAiService.interpretLayoutIntent({
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
  }
}

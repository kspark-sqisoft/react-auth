import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookPageInputDto } from './book-page-input.dto';

export class UpdateBookDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional({ description: '공통 슬라이드 너비(px)' })
  slideWidth?: number;

  @ApiPropertyOptional({ description: '공통 슬라이드 높이(px)' })
  slideHeight?: number;

  @ApiPropertyOptional({
    description: '내면 페이지 전체 교체',
    type: BookPageInputDto,
    isArray: true,
  })
  pages?: BookPageInputDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookPageInputDto } from './book-page-input.dto';

export class CreateBookDto {
  @ApiProperty({ example: '내 프레젠테이션' })
  title!: string;

  @ApiPropertyOptional({ description: '공통 슬라이드 너비(px)' })
  slideWidth?: number;

  @ApiPropertyOptional({ description: '공통 슬라이드 높이(px)' })
  slideHeight?: number;

  @ApiPropertyOptional({ type: BookPageInputDto, isArray: true })
  pages?: BookPageInputDto[];
}

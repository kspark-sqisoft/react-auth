import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** 북 생성·수정 시 페이지 한 줄 */
export class BookPageInputDto {
  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({
    description: '슬라이드 배경 CSS 색(예: #aabbcc); 생략 시 #ffffff',
  })
  backgroundColor?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
  })
  elements?: unknown[];
}

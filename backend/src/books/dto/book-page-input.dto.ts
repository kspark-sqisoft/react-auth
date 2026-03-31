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

  @ApiPropertyOptional({
    description:
      '슬라이드쇼 시간 기준이 될 요소 id(해당 페이지 elements 내). 비우면 기본 시간',
    nullable: true,
  })
  presentationTimingElementId?: string | null;

  @ApiPropertyOptional({
    description:
      '이 슬라이드로 전환될 때 효과: none, fade, slideLeft, slideRight, slideUp, slideDown, zoomIn, blurIn',
    example: 'fade',
  })
  presentationTransition?: string;

  @ApiPropertyOptional({
    description: '전환 지속 시간(ms). 80~2500, 생략 시 450',
    example: 450,
  })
  presentationTransitionMs?: number;
}

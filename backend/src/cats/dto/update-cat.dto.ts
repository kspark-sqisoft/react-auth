import { ApiPropertyOptional } from '@nestjs/swagger';

/** PATCH /cats/:id — 최소 한 필드 이상. */
export class UpdateCatDto {
  @ApiPropertyOptional({ description: '이름', example: '나비' })
  name?: string;

  @ApiPropertyOptional({ description: '나이 0~40', example: 3, minimum: 0, maximum: 40 })
  age?: number;

  @ApiPropertyOptional({ description: '품종', example: '코리안숏헤어' })
  breed?: string;
}

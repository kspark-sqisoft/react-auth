import { ApiPropertyOptional } from '@nestjs/swagger';

/** 글 수정 multipart 텍스트 필드(새 파일은 `newFiles`·`newPosters`) */
export class UpdatePostFieldsDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  content?: string;

  @ApiPropertyOptional({
    example: 'life',
    description: 'tech | life | study | chat | general',
  })
  category?: string;

  @ApiPropertyOptional({
    description:
      'JSON: {"items":[{"t":"e","id":1},{"t":"n","i":0}]} — 기존(e)·새(n) 순서',
  })
  mediaPlan?: string;

  @ApiPropertyOptional({
    enum: ['1', 'true', 'on'],
    description: '첨부 전부 제거(mediaPlan 없을 때)',
  })
  removeMedia?: string;

  @ApiPropertyOptional({
    enum: ['1', 'true', 'on'],
    description: '호환: removeMedia와 동일',
  })
  removeImage?: string;

  @ApiPropertyOptional({
    enum: ['1', 'true', 'on'],
    description: '호환: removeMedia와 동일',
  })
  removeVideo?: string;
}

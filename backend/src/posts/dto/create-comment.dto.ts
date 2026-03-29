import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: '댓글 내용' })
  content!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: '대댓글일 때 부모 댓글 id',
  })
  parentId?: number | null;
}

import { ApiProperty } from '@nestjs/swagger';

/** `multipart/form-data`에서 제목·본문(첨부는 별도 필드) */
export class CreatePostFieldsDto {
  @ApiProperty({ example: '제목' })
  title!: string;

  @ApiProperty({ example: '본문' })
  content!: string;
}

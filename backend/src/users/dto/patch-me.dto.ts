import { ApiPropertyOptional } from '@nestjs/swagger';

/** multipart `name`·`removeImage` 텍스트 필드(이미지 파일은 별도 필드) */
export class PatchMeDto {
  @ApiPropertyOptional({
    description: '표시 이름(1~100자, 공백만은 불가)',
  })
  name?: string;

  @ApiPropertyOptional({
    enum: ['1', 'true', 'on'],
    description: '기존 프로필 이미지 제거(새 파일 없을 때)',
  })
  removeImage?: string;
}

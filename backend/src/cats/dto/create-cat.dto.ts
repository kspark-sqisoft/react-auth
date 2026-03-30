import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * DTO (Data Transfer Object)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: “계층 사이로 넘어가는 데이터의 모양”을 고정합니다 (생성 요청 body 등).
 * - 런타임 검증은 Pipe(class-validator 등)나 여기서는 ParseCreateCatPipe가 담당합니다.
 * - @ApiProperty / @ApiPropertyOptional : Swagger UI에 필드 설명·예시·필수 여부를 보여 주기 위함.
 *   OpenAPI 스키마와 실제 서버 검증 규칙이 어긋나지 않게 맞추는 것이 좋습니다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export class CreateCatDto {
  @ApiProperty({
    description: '이름 (필수). 공백만 있는 문자열은 불가',
    example: '나비',
    minLength: 1,
  })
  name!: string;

  @ApiPropertyOptional({
    description: '나이. 생략 시 1. 0~40 정수 (ParseCreateCatPipe와 동일 규칙)',
    example: 3,
    minimum: 0,
    maximum: 40,
    type: Number,
  })
  age?: number;

  @ApiPropertyOptional({
    description: '품종. 생략 시 DB에 mixed 로 저장',
    example: '코리안숏헤어',
  })
  breed?: string;
}

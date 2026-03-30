import { NotFoundException } from '@nestjs/common';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 도메인 예외 (HttpException 계열)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: “비즈니스적으로 리소스가 없다”는 의미를 코드에서 구분하기 쉽게 만듭니다.
 * - NotFoundException 을 상속하므로 기본 HTTP 상태 코드는 404입니다.
 * - 서비스에서 throw → (선택) ExceptionFilter에서 잡아 응답 body를 커스터마이징합니다.
 *   Filter가 없으면 Nest가 HttpException 메시지를 담은 기본 JSON 형태로 응답합니다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export class CatNotFoundException extends NotFoundException {
  constructor(id: number) {
    super(`고양이 id=${id} 를 찾을 수 없습니다.`);
  }
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * HTTP 상태 코드 참고 (이 API에서 자주 쓰는 것 위주)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Nest `HttpException` / 내장 예외 → 기본 status 매핑:
 *
 *   400 Bad Request          `BadRequestException` — 본문·쿼리 검증 실패, Pipe 거부 등
 *                            (예: cats `ParseCreateCatPipe`, posts/books 입력 검증)
 *   401 Unauthorized         `UnauthorizedException` — 로그인·JWT 없음/만료 (Guard)
 *   403 Forbidden            `ForbiddenException` — 인증은 됐으나 리소스 권한 없음
 *   404 Not Found            `NotFoundException` — 글·댓글·북 등 대상 없음
 *   409 Conflict             `ConflictException` — 중복 등 충돌 (필요 시)
 *   502 Bad Gateway          `BadGatewayException` — 외부 API(날씨 등) 실패·비정상 응답
 *   503 Service Unavailable  `ServiceUnavailableException` — 일시적 불가(외부 서비스)
 *
 * 그 외 일반적으로 알아두면 좋은 코드:
 *
 *   200 OK           조회·수정 성공(본문 있음). GET 기본, PUT/PATCH 성공
 *   201 Created      POST로 리소스 생성 성공(생성 위치는 Location 또는 body)
 *   204 No Content   성공했으나 응답 본문 없음(삭제 등)
 *   304 Not Modified 조건부 GET 캐시
 *   422 Unprocessable Entity — 검증 실패를 400과 구분해 쓰는 API도 있음(본 프로젝트는 주로 400)
 *   500 Internal Server Error — 처리되지 않은 예외(Nest 기본 필터)
 *
 * 실제 응답 형식은 전역 Exception Filter / Swagger 문서를 함께 보면 됩니다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { Controller, Get, Logger, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AppDomainSpanInterceptor } from './app-domain-span';

@ApiTags('app')
@Controller()
@UseInterceptors(AppDomainSpanInterceptor)
export class AppController {
  private readonly logger = new Logger('AppController');

  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '헬스 체크용 인사' })
  getHello(): string {
    this.logger.log('[APP·컨트롤러] getHello() 핸들러 진입');
    return this.appService.getHello();
  }
}

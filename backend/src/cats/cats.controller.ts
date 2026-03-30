import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateCatDto } from './dto/create-cat.dto';
import {
  CatsClientMeta,
  type CatsClientSnapshot,
} from './decorators/cats-client-meta.decorator';
import { CatNotFoundFilter } from './filters/cat-not-found.filter';
import { CatsAfterJwtLogGuard } from './guards/cats-after-jwt-log.guard';
import { CatsBeforeJwtLogGuard } from './guards/cats-before-jwt-log.guard';
import { CatsJwtLogGuard } from './guards/cats-jwt-log.guard';
import { CatsLoggingInterceptor } from './interceptors/cats-logging.interceptor';
import { CatsParseIntIdPipe } from './pipes/cats-parse-int-id.pipe';
import { ParseCreateCatPipe } from './pipes/parse-create-cat.pipe';
import { CatsService } from './cats.service';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Controller (컨트롤러)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: URL 경로·HTTP 메서드(GET/POST/…)와 “핸들러 메서드”를 연결합니다.
 * - 비즈니스 로직은 Service에 두고, 컨트롤러는 요청/응답 매핑과 데코레이터 조합이 중심입니다.
 *
 * 클래스/메서드에 붙이는 주요 데코레이터 (실행 순서와 연관)
 * - @UseInterceptors : 핸들러 전후(또는 오류 흐름)에 공통 로직. 여기서는 전역(컨트롤러 단위) 로깅.
 * - @UseFilters     : 이 컨트롤러에서 발생한 특정 예외를 잡아 응답 body 형식을 통일.
 * - @UseGuards      : 메서드별로 “이 요청을 실행해도 되는지” 사전 판단 (인증/인가 등).
 * - @Body/@Param + Pipe : 파라미터마다 Pipe가 실행되어 변환·검증 (내장 ParseIntPipe, 커스텀 ParseCreateCatPipe).
 * - 커스텀 @CatsClientMeta() : 파라미터 데코레이터로 요청 객체에서 값을 꺼내 주입.
 *
 * Swagger(@ApiTags, @ApiOperation, @ApiBody, @ApiBearerAuth)
 * - API 문서용 메타데이터이며, 런타임 Nest 파이프라인과는 별개입니다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@ApiTags('cats-study')
@Controller('cats')
@UseInterceptors(CatsLoggingInterceptor)
@UseFilters(CatNotFoundFilter)
export class CatsController {
  private readonly logger = new Logger('CatsController');

  constructor(private readonly catsService: CatsService) {}

  @Get()
  @ApiOperation({ summary: '[학습] 고양이 목록 (공개)' })
  /**
   * @CatsClientMeta() : 커스텀 파라미터 데코레이터 예시.
   * ExecutionContext → HTTP Request에서 ip, user-agent를 꺼내 한 객체로 주입합니다.
   */
  findAll(@CatsClientMeta() meta: CatsClientSnapshot) {
    this.logger.log(`[CATS-09-CTRL] findAll() 핸들러 진입`);
    return this.catsService.findAll().then((cats) => ({
      cats,
      _study: { decoratorCatsClientMeta: meta },
    }));
  }

  @Get(':id')
  @ApiOperation({
    summary:
      '[학습] 단건 조회 (공개, ParseIntPipe + CatNotFoundException → Filter)',
  })
  /**
   * CatsParseIntIdPipe : :id 검증·변환 후 핸들러의 id는 number.
   * 서비스에서 데이터가 없으면 CatNotFoundException → CatNotFoundFilter.
   */
  findOne(@Param('id', CatsParseIntIdPipe) id: number) {
    this.logger.log(`[CATS-09-CTRL] findOne(${id}) 핸들러 진입`);
    return this.catsService.findOne(id);
  }

  @Post()
  @UseGuards(CatsBeforeJwtLogGuard, CatsJwtLogGuard, CatsAfterJwtLogGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateCatDto })
  @ApiOperation({
    summary: '[학습] 생성 (로그인 필요)',
    description:
      'Authorization Bearer 액세스 JWT 필요. Body는 아래 스키마·ParseCreateCatPipe 규칙과 동일.',
  })
  /**
   * @Body(ParseCreateCatPipe) : body 전체를 커스텀 Pipe에 통과시킨 뒤 CreateCatDto 형태로 받습니다.
   * Guard들이 먼저 실행되므로, 비로그인이면 Pipe·핸들러까지 오지 않습니다.
   */
  create(@Body(ParseCreateCatPipe) dto: CreateCatDto) {
    this.logger.log(`[CATS-09-CTRL] create() 핸들러 진입 | DTO로 SVC 호출`);
    return this.catsService.create(dto);
  }

  @Delete(':id')
  @UseGuards(CatsBeforeJwtLogGuard, CatsJwtLogGuard, CatsAfterJwtLogGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[학습] 삭제 (로그인 필요)' })
  remove(@Param('id', CatsParseIntIdPipe) id: number) {
    this.logger.log(`[CATS-09-CTRL] remove(${id}) 핸들러 진입`);
    return this.catsService.remove(id).then(() => ({ deletedId: id }));
  }
}

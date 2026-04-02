import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import {
  CatsClientMeta,
  type CatsClientSnapshot,
} from './decorators/cats-client-meta.decorator';
import { CatNotFoundFilter } from './filters/cat-not-found.filter';
import { CatsAfterJwtLogGuard } from './guards/cats-after-jwt-log.guard';
import { CatsBeforeJwtLogGuard } from './guards/cats-before-jwt-log.guard';
import { CatsJwtLogGuard } from './guards/cats-jwt-log.guard';
import { CatsStudyGuard } from './guards/cats-study.guard';
import { CatsLoggingInterceptor } from './interceptors/cats-logging.interceptor';
import { CatsParseIntIdPipe } from './pipes/cats-parse-int-id.pipe';
import { ParseCreateCatPipe } from './pipes/parse-create-cat.pipe';
import { ParseUpdateCatPipe } from './pipes/parse-update-cat.pipe';
import { catImageMulterOptions } from './cat-image-upload.options';
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
 * 요청 생명주기(미들웨어→가드→인터셉터→파이프→…→필터)는 **src/cats/REQUEST_FLOW.md** 와 `cats.module.ts` 주석을 본다.
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
    this.logger.log(`[CATS·컨트롤러] findAll() 핸들러 진입`);
    return this.catsService.findAll().then((cats) => ({
      cats,
      _study: { decoratorCatsClientMeta: meta },
    }));
  }

  /**
   * `@Get(':id')`보다 **위**에 두어야 `_study`가 id로 잡히지 않습니다.
   * Middleware → CatsStudyGuard → Interceptor → … 순서만 보기 위한 최소 라우트.
   */
  @Get('_study/guard-sample')
  @UseGuards(CatsStudyGuard)
  @ApiOperation({
    summary: '[학습] Guard 단독 데모',
    description:
      '요청 헤더 `x-cats-study: yes` 필요. 없으면 401. JWT 없음. REQUEST_FLOW.md 참고.',
  })
  studyGuardSample() {
    this.logger.log(`[CATS·컨트롤러] studyGuardSample() CatsStudyGuard 통과`);
    return {
      ok: true,
      hint: 'CatsStudyGuard 이후 컨트롤러까지 도달. 순서는 REQUEST_FLOW.md 참고.',
    };
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
    this.logger.log(`[CATS·컨트롤러] findOne(${id}) 핸들러 진입`);
    return this.catsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(CatsBeforeJwtLogGuard, CatsJwtLogGuard, CatsAfterJwtLogGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: UpdateCatDto })
  @ApiOperation({
    summary: '[학습] 정보 수정 (로그인 필요)',
    description: 'name, age, breed 중 최소 하나. 생략한 필드는 그대로 둡니다.',
  })
  update(
    @Param('id', CatsParseIntIdPipe) id: number,
    @Body(ParseUpdateCatPipe) dto: UpdateCatDto,
  ) {
    this.logger.log(`[CATS·컨트롤러] patch(${id}) 핸들러 진입`);
    return this.catsService.update(id, dto);
  }

  @Post(':id/image')
  @UseGuards(CatsBeforeJwtLogGuard, CatsJwtLogGuard, CatsAfterJwtLogGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'JPEG/PNG/GIF/WebP, 최대 3MB',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image', catImageMulterOptions()))
  @ApiOperation({
    summary: '[학습] 고양이 사진 업로드·교체 (로그인 필요)',
    description:
      'multipart 필드명 `image`. 기존 파일이 있으면 서버에서 삭제 후 교체합니다.',
  })
  uploadImage(
    @Param('id', CatsParseIntIdPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.logger.log(`[CATS·컨트롤러] uploadImage(${id}) 핸들러 진입`);
    if (!file?.filename) {
      throw new BadRequestException('image 파일이 필요합니다.');
    }
    return this.catsService.uploadImage(id, file.filename);
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
    this.logger.log(`[CATS·컨트롤러] create() 핸들러 진입 | DTO로 서비스 호출`);
    return this.catsService.create(dto);
  }

  @Delete(':id')
  @UseGuards(CatsBeforeJwtLogGuard, CatsJwtLogGuard, CatsAfterJwtLogGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '[학습] 삭제 (로그인 필요)' })
  remove(@Param('id', CatsParseIntIdPipe) id: number) {
    this.logger.log(`[CATS·컨트롤러] remove(${id}) 핸들러 진입`);
    return this.catsService.remove(id).then(() => ({ deletedId: id }));
  }
}

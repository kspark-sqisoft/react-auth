import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Cat } from './cat.entity';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';
import { CatNotFoundFilter } from './filters/cat-not-found.filter';
import { CatsAfterJwtLogGuard } from './guards/cats-after-jwt-log.guard';
import { CatsBeforeJwtLogGuard } from './guards/cats-before-jwt-log.guard';
import { CatsJwtLogGuard } from './guards/cats-jwt-log.guard';
import { CatsLoggingInterceptor } from './interceptors/cats-logging.interceptor';
import { CatsLoggerMiddleware } from './middleware/cats-logger.middleware';
import { CatsParseIntIdPipe } from './pipes/cats-parse-int-id.pipe';
import { ParseCreateCatPipe } from './pipes/parse-create-cat.pipe';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Module (모듈)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - 역할: 이 도메인(cats)에 속한 Controller, Service, Guard, Pipe 등을 한 덩어리로 묶고,
 *   AppModule 같은 상위 모듈의 `imports`에 넣어 애플리케이션에 등록합니다.
 * - `@Module({ imports, controllers, providers, exports })`
 *   - imports: 다른 모듈을 가져옴. 여기서는 TypeORM에 Cat 엔티티를 등록해 Repository 주입이 가능해짐.
 *   - controllers: HTTP 라우트를 정의하는 클래스.
 *   - providers: Nest DI 컨테이너에 등록되는 클래스(@Injectable 등). Service, Guard, Pipe, Filter,
 *     Interceptor, Middleware 클래스를 쓰려면 대개 여기(또는 전역 모듈)에 넣어야 합니다.
 *
 * NestModule + configure()
 * - 미들웨어는 `@Module` 데코레이터만으로는 라우트에 붙이지 못합니다.
 * - `NestModule`을 구현하고 `configure(consumer)` 안에서 `MiddlewareConsumer`로
 *   어떤 미들웨어를 어떤 경로/컨트롤러에 적용할지 지정합니다.
 *   예: `consumer.apply(CatsLoggerMiddleware).forRoutes(CatsController)`
 *
 * ┌─────────────────────────────────────────────────────────────────
 * │ Cats HTTP 요청 처리 순서 (위 → 아래, 콘솔 로그 접두사와 대응)
 * └─────────────────────────────────────────────────────────────────
 *
 *                    클라이언트 HTTP 요청
 *                            │
 *                            ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │  `[진입] CATS …` / `[완료] CATS …`  (CatsLoggerMiddleware) │
 *    └───────────────────────────┬──────────────────────────────┘
 *                                │
 *              ┌─────────────────┴─────────────────┐
 *              │ POST /cats  또는 DELETE /cats/:id │     GET /cats , GET /cats/:id
 *              ▼                                   │              │
 *    ┌─────────────────────┐                     │              │
 *    │ [CATS·가드·JWT이전]  CatsBeforeJwtLogGuard │              │
 *    ├─────────────────────┤                     │              │
 *    │ [CATS·가드·JWT검증]  CatsJwtLogGuard       │   (JWT 없음 → 바로 아래)
 *    ├─────────────────────┤                     │              │
 *    │ [CATS·가드·JWT이후]  CatsAfterJwtLogGuard  │              │
 *    └──────────┬──────────┘                     │              │
 *               └─────────────────┬─────────────┴──────────────┘
 *                                 ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │ [CATS·인터셉터·직전] CatsLoggingInterceptor → next.handle() │
 *    └───────────────────────────┬──────────────────────────────┘
 *                                │
 *         라우트별 파라미터 해석 (해당하는 것만 실행)
 *                                │
 *         ┌──────────────────────┼──────────────────────┐
 *         ▼                      ▼                      ▼
 *   [CATS·파이프·경로ID]   [CATS·파이프·요청본문]   [CATS·데코레이터·파라미터]
 *   CatsParseIntIdPipe     ParseCreateCatPipe     @CatsClientMeta()
 *   (:id 경로)             (POST body)            (GET 목록 meta)
 *         │                      │                      │
 *         └──────────────────────┴──────────────────────┘
 *                                │
 *                                ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │ [CATS·컨트롤러]  CatsController  (findAll / findOne / …)  │
 *    └───────────────────────────┬──────────────────────────────┘
 *                                │
 *                                ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │ [CATS·서비스]  CatsService  (DB·도메인 로직)               │
 *    └───────────────────────────┬──────────────────────────────┘
 *                                │
 *              ┌─────────────────┴─────────────────┐
 *              │ 정상 응답                          │  CatNotFoundException 등
 *              ▼                                   ▼
 *    ┌─────────────────────┐           ┌─────────────────────┐
 *    │ [CATS·인터셉터·완료]  tap        │ [CATS·인터셉터·에러] catchError
 *    │ (소요 시간)           │           │ (재전파)            │
 *    └──────────┬──────────┘           └──────────┬──────────┘
 *               │                               │
 *               │                               ▼
 *               │                    ┌─────────────────────┐
 *               │                    │ [CATS·예외필터]      │
 *               │                    │ CatNotFoundFilter   │
 *               │                    │ → JSON 404          │
 *               │                    └─────────────────────┘
 *               │
 *               ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │  res.on('finish') → `[완료] CATS …` (요청 단위 끝)        │
 *    └──────────────────────────────────────────────────────────┘
 *
 * 콘솔 Logger 컨텍스트: CatsLoggerMiddleware, CatsGuard…, CatsLoggingInterceptor,
 *   CatsParseIntIdPipe, ParseCreateCatPipe, CatsClientMeta 데코레이터,
 *   CatsController, CatsService, CatNotFoundFilter
 *
 * 콘솔 검색: `[진입]`·`[완료]`·`id=` 또는 `[CATS·`. 프론트는 `[CATS-C01]`~`C08`, `CATS-CERR`.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
@Module({
  /** TypeORM: 이 모듈 범위에서 Cat 엔티티용 Repository를 주입할 수 있게 함 */
  /** AuthModule: JwtStrategy 등 — 컨트롤러의 JwtAuthGuard가 Bearer 검증할 때 필요 */
  imports: [TypeOrmModule.forFeature([Cat]), AuthModule],
  controllers: [CatsController],
  providers: [
    CatsService,
    CatsLoggingInterceptor,
    CatNotFoundFilter,
    ParseCreateCatPipe,
    CatsParseIntIdPipe,
    CatsBeforeJwtLogGuard,
    CatsJwtLogGuard,
    CatsAfterJwtLogGuard,
    /** 미들웨어 클래스도 DI로 주입되려면 providers에 등록하는 것이 일반적 */
    CatsLoggerMiddleware,
  ],
})
export class CatsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CatsLoggerMiddleware).forRoutes(CatsController);
  }
}

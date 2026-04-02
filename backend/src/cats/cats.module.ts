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
import { CatsStudyGuard } from './guards/cats-study.guard';
import { CatsLoggingInterceptor } from './interceptors/cats-logging.interceptor';
import { CatsLoggerMiddleware } from './middleware/cats-logger.middleware';
import { CatsParseIntIdPipe } from './pipes/cats-parse-int-id.pipe';
import { ParseCreateCatPipe } from './pipes/parse-create-cat.pipe';
import { ParseUpdateCatPipe } from './pipes/parse-update-cat.pipe';

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
 * │ Cats HTTP 요청 처리 (Nest 공식 순서와 대응 — 자세한 설명은 REQUEST_FLOW.md)
 * └─────────────────────────────────────────────────────────────────
 *
 * ① Middleware      → CatsLoggerMiddleware (`[진입] CATS` … `[완료] CATS`)
 * ② Guards          → 라우트에 따라: JWT 3종(Before/Jwt/After) 또는 CatsStudyGuard(`GET …/_study/guard-sample`)
 * ③ Interceptor     → CatsLoggingInterceptor — `intercept()` 진입 후 `next.handle()`이 ④~⑦을 실행
 * ④ Pipes           → CatsParseIntIdPipe, ParseCreate/UpdateCatPipe, @CatsClientMeta()
 * ⑤ Controller      → CatsController
 * ⑥ Service         → CatsService
 * ⑦ Repository      → TypeORM `Repository<Cat>` (서비스 내부에서 find/save/delete …)
 *
 *                    클라이언트 HTTP 요청
 *                            │
 *                            ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │  ① `[진입] CATS …` / `[완료] CATS …`  CatsLoggerMiddleware │
 *    └───────────────────────────┬──────────────────────────────┘
 *                                ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │  ② Guards (해당 라우트에만)                                 │
 *    │     JWT 라우트: Before → JwtAuth(로그) → After             │
 *    │     공개 GET: 생략 │ 학습: CatsStudyGuard만 (`_study/guard-sample`) │
 *    └───────────────────────────┬──────────────────────────────┘
 *                                ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │  ③ `[CATS·인터셉터·직전]` CatsLoggingInterceptor           │
 *    │     next.handle() ───────────────────────────────┐       │
 *    └──────────────────────────────────────────────────│───────┘
 *                                                       ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │  ④ Pipes → ⑤ Controller → ⑥ Service → ⑦ Repository        │
 *    └───────────────────────────┬──────────────────────────────┘
 *                                │ Observable 성공/실패
 *              ┌─────────────────┴─────────────────┐
 *              ▼                                   ▼
 *    ┌─────────────────────┐           ┌─────────────────────┐
 *    │ ③ tap `[CATS·인터셉터·완료]` │       │ ③ catchError 로그 후 │
 *    │                       │           │    예외 재전파        │
 *    └──────────┬────────────┘           └──────────┬──────────┘
 *               │                                   ▼
 *               │                        ┌─────────────────────┐
 *               │                        │ ExceptionFilter     │
 *               │                        │ CatNotFoundFilter   │
 *               │                        │ (CatNotFound만)     │
 *               │                        └─────────────────────┘
 *               ▼
 *    ┌──────────────────────────────────────────────────────────┐
 *    │  Express 응답 후 미들웨어의 `finish` 로그                  │
 *    └──────────────────────────────────────────────────────────┘
 *
 * 콘솔 검색: `[진입]`·`[완료]`·`[CATS·`. 상세·표: **src/cats/REQUEST_FLOW.md**
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
    ParseUpdateCatPipe,
    CatsParseIntIdPipe,
    CatsBeforeJwtLogGuard,
    CatsJwtLogGuard,
    CatsAfterJwtLogGuard,
    /** 학습용: `GET /cats/_study/guard-sample` 전용 (REQUEST_FLOW.md 참고) */
    CatsStudyGuard,
    /** 미들웨어 클래스도 DI로 주입되려면 providers에 등록하는 것이 일반적 */
    CatsLoggerMiddleware,
  ],
})
export class CatsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CatsLoggerMiddleware).forRoutes(CatsController);
  }
}

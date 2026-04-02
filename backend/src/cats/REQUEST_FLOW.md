# Cats 모듈 — HTTP 요청·응답 생명주기 (NestJS 학습용)

이 폴더는 **미들웨어 → 가드 → 인터셉터 → 파이프 → 컨트롤러 → 서비스 → 리포지토리** 순으로 요청이 들어가고, 예외가 나면 **예외 필터**가 응답을 만든 뒤, 인터셉터의 Observable 체인이 정리되는 흐름을 **로그와 코드**로 따라갈 수 있게 구성되어 있습니다.

공식 문서: [Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle) (영문, 순서의 기준).

---

## 1. NestJS가 정한 들어오는 요청(inbound) 순서

아래는 **한 핸들러에 도달하기까지**의 대표 순서입니다. (전역/모듈 등록 여부에 따라 일부 단계는 생략됩니다.)

| 단계 | 역할 | Cats 모듈에서의 예 |
|------|------|-------------------|
| 1. **Middleware** | Express `(req, res, next)`에 가깝게, 라우트보다 바깥 | `CatsLoggerMiddleware` — `[진입] CATS` / `res.on('finish')`로 `[완료] CATS` |
| 2. **Guards** | 이 요청으로 핸들러를 실행할지(`canActivate`) | JWT 필요 라우트: `CatsBeforeJwtLogGuard` → `CatsJwtLogGuard` → `CatsAfterJwtLogGuard`. 학습 전용: `GET /cats/_study/guard-sample`의 `CatsStudyGuard` |
| 3. **Interceptors** (`intercept()` 안에서 **`next.handle()` 호출 전** 코드) | 이후 파이프라인을 Observable로 감쌈 | `CatsLoggingInterceptor` — `[CATS·인터셉터·직전]` |
| 4. **Pipes** | 파라미터·body 변환·검증 | `CatsParseIntIdPipe`, `ParseCreateCatPipe`, `ParseUpdateCatPipe`, `@CatsClientMeta()` |
| 5. **Controller** | 라우트 핸들러 메서드 | `CatsController` |
| 6. **Service** | 도메인 로직 | `CatsService` |
| 7. **Repository** (TypeORM) | DB 접근 — 서비스 안에서 주입된 `Repository<Cat>` 사용 | `this.cats.find()`, `findOne`, `save`, `delete` 등 |

**주의:** 사용자말로 “Pipe가 인터셉터보다 먼저”라고 착각하기 쉬운데, Nest 문서 기준으로는 **인터셉터의 `intercept()`가 먼저 호출되고**, 그 안의 `next.handle()`이 **파이프·컨트롤러·서비스** 쪽 실행을 이어갑니다. 그래서 로그상으로는 **인터셉터 “직전” 로그 → 파이프 로그 → 컨트롤러** 순이 맞습니다.

---

## 2. 정상 응답이 나갈 때(성공 경로)

1. 서비스/리포지토리가 값을 반환 → 컨트롤러가 Promise/Observable로 넘김  
2. **`next.handle()`**의 Observable이 **성공적으로 완료**  
3. 같은 인터셉터의 `tap()` 등 **이후** 로직 실행 — Cats에서는 `[CATS·인터셉터·완료]` 및 소요 ms  
4. Express가 응답을 보냄 → (미들웨어에서 걸어둔) `res.on('finish')`로 `[완료] CATS`

`POST /cats/:id/image`처럼 **메서드에만** `@UseInterceptors(FileInterceptor(...))`가 붙은 경우, Nest는 **컨트롤러 단 인터셉터 + 라우트 단 인터셉터**를 순서 규칙에 따라 겹쳐 씁니다. 자세한 중첩 순서는 공식 문서의 Interceptors 절을 참고하면 됩니다.

---

## 3. 예외가 났을 때(에러 경로)

1. **Pipe / Controller / Service / Repository** 어디서든 `throw`되면, 그 예외가 위로 전파됩니다.  
2. **`next.handle()`**을 감싼 인터셉터에서 `catchError`로 잡을 수 있습니다 — Cats의 `CatsLoggingInterceptor`는 `[CATS·인터셉터·에러]` 로그 후 **`throwError`로 다시 던짐** (필터에 맡김).  
3. **`@Catch(...)` Exception filter** 중 매칭되는 것이 응답을 작성합니다 — Cats에서는 `CatNotFoundFilter`가 `CatNotFoundException`만 잡아 JSON 404를 만듭니다.  
4. 그 밖의 예외는 Nest 기본 예외 계층 또는 다른 전역 필터가 처리할 수 있습니다.

즉, **“필터가 항상 인터셉터보다 먼저”는 아닙니다.** 인터셉터가 에러를 삼키지 않고 재전파하면, 필터 단계에서 HTTP 응답이 만들어집니다.

---

## 4. 파일·로그로 따라가기

| 파일 | 설명 |
|------|------|
| `cats.module.ts` | `configure()`로 미들웨어 등록, 모듈 상단 주석에 전체 다이어그램 |
| `middleware/cats-logger.middleware.ts` | 1단계 미들웨어 |
| `guards/*.ts` | 2단계 가드 (JWT 로그용 / `CatsStudyGuard` 학습용) |
| `interceptors/cats-logging.interceptor.ts` | 3단계 인터셉터 |
| `pipes/*.ts` | 4단계 파이프 |
| `cats.controller.ts` | 5단계 컨트롤러 |
| `cats.service.ts` | 6단계 서비스 + TypeORM **Repository** 호출 |
| `filters/cat-not-found.filter.ts` | `CatNotFoundException` 전용 필터 |

콘솔에서 `[CATS·`, `[진입]`, `[완료]`로 검색하면 한 요청의 흐름을 대략 재구성할 수 있습니다.

---

## 5. 학습용 엔드포인트

- **`GET /cats/_study/guard-sample`**  
  - 헤더 **`x-cats-study: yes`** 가 없으면 401 (`CatsStudyGuard`).  
  - JWT·다른 가드 없이 **가드 한 겹만** 보고 싶을 때 사용합니다.  
  - 경로가 `cats/:id`보다 위에 선언되어 있어야 하므로 컨트롤러에서 **`@Get(':id')`보다 위**에 둡니다.

---

## 6. 더 읽을 것

- NestJS: [Middleware](https://docs.nestjs.com/middleware), [Guards](https://docs.nestjs.com/guards), [Interceptors](https://docs.nestjs.com/interceptors), [Pipes](https://docs.nestjs.com/pipes), [Exception filters](https://docs.nestjs.com/exception-filters)  
- 프로젝트 상위 안내: `docs/PROJECT_ARCHITECTURE.md` — **5.2.1 Cats study 모듈 — HTTP 요청 생명주기**

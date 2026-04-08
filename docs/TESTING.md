# 테스트 (Jest) 옵션 정리

이 저장소의 **단위·통합 테스트**는 `backend/`에서 [Jest](https://jestjs.io/docs/cli)를 사용합니다. 프론트엔드(`frontend/`)에는 별도 테스트 스크립트가 없습니다.

작업 디렉터리는 **`backend/`** 기준입니다.

---

## npm 스크립트

| 스크립트 | 하는 일 |
|----------|---------|
| `npm test` | 기본 Jest 1회 실행 (`src/**/*.spec.ts`) |
| `npm run test:watch` | `jest --watch` — 파일 변경 시 관련 테스트만 재실행 |
| `npm run test:cov` | `jest --coverage` — 커버리지 리포트 (`backend/coverage/`) |
| `npm run test:debug` | Node 디버거 + Jest (`--runInBand`, 단일 프로세스) |
| `npm run test:e2e` | E2E 전용 설정 (`test/jest-e2e.json`, `*.e2e-spec.ts`) |

스크립트 뒤에 **추가 인자**를 넘기려면 npm에서 `--` 뒤에 붙입니다.

```bash
npm test -- --help
npm test -- src/auth/auth.service.spec.ts
npm run test:e2e -- --testPathPattern=auth
```

---

## 자주 쓰는 Jest CLI 옵션

아래는 `npm test -- <옵션>` 또는 `npx jest <옵션>` 형태로 동일하게 사용할 수 있습니다.

### 실행 범위

| 옵션 | 설명 |
|------|------|
| `--testPathPattern=<regex>` | 경로·파일명이 정규식에 맞는 스위트만 실행 (예: `auth`, `posts\\.service`) |
| `--testNamePattern=<regex>` | `it` / `describe` 이름이 맞는 케이스만 실행 |
| `-t "문자열"` | `--testNamePattern` 단축 |

```bash
npm test -- --testPathPattern=users
npm test -- -t "should return"
```

### 동작·병렬

| 옵션 | 설명 |
|------|------|
| `--runInBand` / `-i` | 워커 1개, 순차 실행. DB·포트 공유, 플레이키 테스트 줄일 때 유용 |
| `--maxWorkers=N` | 동시 워커 수 제한 (기본은 CPU 코어 수 근처) |
| `--bail` / `-b` | 첫 실패에서 중단 |
| `--forceExit` | 대기 중인 핸들이 있어도 프로세스 종료 (원인 숨길 수 있어 남용 비권장) |
| `--detectOpenHandles` | 종료되지 않는 타이머·DB 연결 등 힌트 출력 |

### 출력·디버깅

| 옵션 | 설명 |
|------|------|
| `--verbose` | 각 테스트 이름 출력 |
| `--silent` | 로그 최소화 |
| `--no-cache` | 변환 캐시 무시 (이상한 캐시 의심 시) |
| `--clearCache` | Jest 캐시만 비우고 종료 |
| `--showSeed` | 난수 시드 출력 (순서 의존 버그 재현 시) |

### 커버리지 (`test:cov`와 함께)

| 옵션 | 설명 |
|------|------|
| `--coverage` | 커버리지 수집 (`package.json`의 `collectCoverageFrom` 반영) |
| `--collectCoverageFrom='glob'` | 추가/대체 글로브 |
| `--coveragePathIgnorePatterns` | 커버리지에서 제외 패턴 |

### Watch 모드 (`test:watch`)

| 키/동작 | 설명 |
|---------|------|
| `a` | 전체 테스트 다시 실행 |
| `f` | 실패한 테스트만 |
| `p` | 파일 이름 패턴 필터 |
| `t` | 테스트 이름 패턴 필터 |
| `q` | 종료 |

전체 목록은 `npm test -- --help` 또는 [Jest CLI 문서](https://jestjs.io/docs/cli)를 참고합니다.

---

## E2E (`test:e2e`)

- 설정 파일: `backend/test/jest-e2e.json`
- 파일 규칙: `*.e2e-spec.ts`
- 환경: `test/setup-e2e-env.ts`에서 DB 등 전제를 맞춤

```bash
cd backend
npm run test:e2e
npm run test:e2e -- --testPathPattern=posts
```

DB는 [DOCKER.md](./DOCKER.md)의 “DB만 Docker” 절처럼 Postgres가 떠 있어야 합니다.

---

## 설정 위치

- **단위 테스트**: `backend/package.json`의 `"jest"` 블록 (`rootDir: src`, `*.spec.ts`)
- **E2E**: `backend/test/jest-e2e.json`

Nest 공식 템플릿과 동일한 구조이므로, `jest.config` 파일로 분리하고 싶다면 `package.json`의 설정을 옮기면 됩니다.

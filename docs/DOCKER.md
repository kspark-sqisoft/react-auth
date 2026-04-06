# Docker 사용법

프로젝트 루트(`react-auth/`) 기준으로 설명합니다. Compose 파일은 두 가지입니다.

| 파일 | 용도 |
|------|------|
| `docker-compose.dev.yml` | 개발: DB + Nest watch + Vite (핫 리로드) |
| `docker-compose.yml` | 배포 연습용: DB + 빌드된 백엔드 + nginx 정적 프론트 |

기본 DB 계정(두 Compose 공통 기본값):

- 사용자: `reactauth`
- 비밀번호: `reactauth`
- DB 이름: `reactauth`
- 포트: 호스트 `5432` → 컨테이너 `5432`

환경 변수로 바꾸려면 루트에 `.env`를 두고 `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`을 설정하면 Compose가 읽습니다.

---

## 전체 스택을 Docker로만 실행

### 개발 모드 (핫 리로드)

저장소 루트에서:

```bash
docker compose -f docker-compose.dev.yml up --build
```

- API: `http://localhost:3000`
- Vite: `http://localhost:5173` 또는 `http://localhost:8080` (같은 dev 서버에 매핑)
- Postgres: `localhost:5432`

이미지나 entrypoint를 바꾼 뒤에만 `--build`가 필요하고, 평소에는 `up`만으로 충분한 경우가 많습니다.

중지:

```bash
docker compose -f docker-compose.dev.yml down
```

볼륨까지 지우려면:

```bash
docker compose -f docker-compose.dev.yml down -v
```

### 운영 스타일 (빌드 이미지, 핫 리로드 없음)

```bash
docker compose up --build
```

- 웹(nginx + 빌드된 SPA): `http://localhost:8080`
- API는 nginx가 같은 오리진에서 `/auth`, `/posts` 등으로 프록시합니다.
- Postgres: `localhost:5432`

---

## DB만 Docker로 띄우고 백엔드만 로컬에서 실행

1. **Postgres만 기동** (dev Compose 예시):

   ```bash
   docker compose -f docker-compose.dev.yml up db -d
   ```

   또는 release Compose의 DB만:

   ```bash
   docker compose up db -d
   ```

   이미 다른 Postgres가 `5432`를 쓰고 있으면 Compose의 `ports`를 바꾸거나, 로컬 백엔드의 `DB_PORT`를 그에 맞춥니다.

2. **`backend/.env` 설정** (예: Compose 기본 계정과 동일할 때):

   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=reactauth
   DB_PASSWORD=reactauth
   DB_NAME=reactauth
   ```

   개발 중 스키마 자동 반영이 필요하면 `NODE_ENV`를 비우거나 `development`로 두면 됩니다(`TYPEORM_SYNC` 미설정 시 non-production에서 synchronize 활성).

3. **백엔드 실행**:

   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

   API: `http://localhost:3000`

---

## DB만 Docker로 띄우고 프론트엔드만 로컬에서 실행

전제: API는 **로컬에서** `http://localhost:3000`에서 떠 있어야 합니다 (위 절차로 백엔드를 띄우거나, 다른 방식으로 3000번에서 서빙).

1. **DB + 백엔드**를 위 “백엔드 단독” 절차대로 준비합니다.

2. **프론트** (`vite.config.ts`는 기본적으로 `localhost:3000`으로 API를 프록시합니다):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   브라우저: `http://localhost:5173`

별도 API 주소를 쓰려면 빌드/실행 전에 예를 들어:

```bash
# Windows PowerShell
$env:VITE_API_BASE_URL="http://localhost:3000"; npm run dev
```

(상대 경로 프록시 대신 절대 URL로 붙일 때 사용합니다.)

---

## 자주 쓰는 명령

| 목적 | 명령 |
|------|------|
| dev 전체 로그 보며 실행 | `docker compose -f docker-compose.dev.yml up` |
| dev 백그라운드 | `docker compose -f docker-compose.dev.yml up -d` |
| 로그만 보기 | `docker compose -f docker-compose.dev.yml logs -f backend` |
| 컨테이너 상태 | `docker compose -f docker-compose.dev.yml ps` |

---

## 시드 데이터 (게시글)

### 무엇을 하는지

- 스크립트: `backend/scripts/seed-dev-posts.ts`
- **가장 먼저 가입한 사용자**(DB에서 `id` 오름차순 첫 행)에게 IT 주제 샘플 글을 여러 개 넣습니다.
- 각 글의 **카테고리**는 `src/posts/post-categories.ts`에 정의된 값 중 하나가 **무작위**로 붙습니다.
- **재실행할 때마다** 같은 개수만큼 **추가**로 삽입됩니다(기존 글을 지우지 않음).

### 실행 방법

**1) 호스트에서** (로컬 Node로 백엔드 개발할 때)

PostgreSQL이 떠 있고, `backend/.env`의 `DB_*`가 그 DB와 일치해야 합니다.

```bash
cd backend
npm run seed:posts
```

**2) dev Compose 백엔드 컨테이너 안에서**

프로젝트 루트에서 dev 스택이 올라간 뒤:

```bash
docker compose -f docker-compose.dev.yml exec backend npm run seed:posts
```

컨테이너의 `/app`이 마운트된 소스이므로, 스크립트를 수정한 뒤에는 별도 빌드 없이 바로 다시 실행하면 됩니다.

### 실행 전 조건

- DB에 **사용자가 최소 1명** 있어야 합니다. 없으면 스크립트가 에러로 종료하므로, 먼저 앱에서 회원가입하거나 다른 수단으로 `user` 행을 넣습니다.
- Nest 앱을 켤 필요는 없습니다. DB와 연결만 되면 됩니다.

### 시드 내용을 늘리거나 바꾸는 방법

1. **`backend/scripts/seed-dev-posts.ts`의 `ROWS` 배열**에 `{ title, content }` 객체를 더 넣습니다. `content`는 글 본문과 동일하게 HTML 문자열입니다.
2. **카테고리**
   - 지금은 `main()` 안에서 `randomPostCategory()`로 매 행마다 무작위입니다.
   - 특정 글만 고정 카테고리를 쓰려면, `postRepo.create({ ... })`에 `category: 'tech'`처럼 넣고, 나머지만 `randomPostCategory()`를 쓰도록 분기하면 됩니다. 허용 값은 `src/posts/post-categories.ts`의 `POST_CATEGORY_VALUES`와 같아야 합니다.
3. **작성자를 바꾸려면** 같은 파일에서 `userRepo.find({ order: { id: 'ASC' }, take: 1 })` 대신, 특정 `email`로 찾거나 `id`로 `findOne` 하는 식으로 바꿉니다.

### 새 종류의 시드 스크립트를 추가하려면

1. `backend/scripts/` 아래에 예: `seed-my-data.ts`를 만듭니다.
2. `seed-dev-posts.ts`와 같이 `reflect-metadata`, `DataSource`, `typeOrmRootOptions()`(또는 동일한 DB 설정)로 연결한 뒤 필요한 엔티티 repository로 `save`합니다.
3. **`backend/package.json`의 `scripts`**에 한 줄 추가합니다:

   ```json
   "seed:my": "ts-node --project tsconfig.seed.json scripts/seed-my-data.ts"
   ```

4. 시드 전용 TypeScript 설정은 **`backend/tsconfig.seed.json`**을 씁니다. 새 스크립트가 `src/`의 추가 파일을 직접 import하는데 컴파일 오류가 나면, `tsconfig.seed.json`의 `include`에 해당 경로를 넣습니다.

---

## E2E 테스트

`backend/test/setup-e2e-env.ts`는 기본으로 `127.0.0.1:5432`의 Postgres(`reactauth` DB)를 가정합니다. 먼저 DB만 띄운 뒤:

```bash
cd backend
npm run test:e2e
```

---

## 포트 충돌

- 로컬에 이미 Postgres가 `5432`를 쓰면 Compose의 `db` 서비스 `ports`를 `5433:5432`처럼 바꾸고, 백엔드 `.env`의 `DB_PORT=5433`으로 맞춥니다.
- `docker-compose.dev.yml`과 `docker-compose.yml`을 **동시에** 띄우면 컨테이너 이름·`5432` 포트가 겹칠 수 있으므로 한쪽만 쓰거나 포트/이름을 조정하세요.

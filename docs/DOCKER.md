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

## 자주 쓰는 명령 (요약)

아래 표는 **개발용 Compose**(`docker-compose.dev.yml`) 기준입니다. 운영 스타일은 `-f docker-compose.dev.yml`을 빼고 같은 패턴으로 쓰면 됩니다.

| 목적 | 명령 |
|------|------|
| dev 전체 로그 보며 실행 | `docker compose -f docker-compose.dev.yml up` |
| dev 백그라운드 | `docker compose -f docker-compose.dev.yml up -d` |
| 특정 서비스만 기동 | `docker compose -f docker-compose.dev.yml up -d db` |
| 로그 스트림 | `docker compose -f docker-compose.dev.yml logs -f` |
| 한 서비스 로그만 | `docker compose -f docker-compose.dev.yml logs -f backend` |
| 컨테이너 상태 | `docker compose -f docker-compose.dev.yml ps` |
| 컨테이너 안에서 셸 | `docker compose -f docker-compose.dev.yml exec backend sh` |
| Postgres 콘솔 | `docker compose -f docker-compose.dev.yml exec db psql -U reactauth -d reactauth` |

**서비스 이름**(Compose): `db`, `backend`, `frontend`  
**컨테이너 이름**(참고): dev는 `react-auth-db-dev`, `react-auth-api-dev`, `react-auth-web-dev` — `docker exec`에 직접 넣을 때 사용합니다.

---

## Docker / Compose CLI 유용 정리

### `docker compose exec` — 이미 떠 있는 컨테이너에서 명령 실행

스택이 `up -d` 등으로 올라간 뒤, **호스트 터미널에서** 컨테이너 안 명령을 실행합니다. 시드 스크립트·일회성 점검에 자주 씁니다.

```bash
# 백엔드 컨테이너에서 npm 스크립트 (예: 게시글 시드)
docker compose -f docker-compose.dev.yml exec backend npm run seed:posts

# 대화형 셸 (Alpine 이미지는 보통 sh)
docker compose -f docker-compose.dev.yml exec backend sh
docker compose -f docker-compose.dev.yml exec frontend sh

# TTY가 필요한 대화형 도구는 -it
docker compose -f docker-compose.dev.yml exec -it db psql -U reactauth -d reactauth
```

- **한 줄 요약**: `exec`는 “같은 Compose 프로젝트·같은 실행 중 서비스”에 붙을 때 경로가 짧습니다.
- 서비스가 꺼져 있으면 실패하므로, 먼저 `docker compose ... ps`로 상태를 확인합니다.

### `docker exec` — 컨테이너 이름/ID로 직접 실행

Compose 없이 **컨테이너 이름**만 알 때 씁니다.

```bash
docker exec -it react-auth-api-dev sh
docker exec react-auth-db-dev psql -U reactauth -d reactauth -c "SELECT 1"
```

`docker ps`로 이름·ID를 확인한 뒤 사용하면 됩니다.

### 로그: `logs`

```bash
# 전체 서비스 팔로우
docker compose -f docker-compose.dev.yml logs -f

# backend만, 최근 200줄부터
docker compose -f docker-compose.dev.yml logs -f --tail=200 backend

# 타임스탬프 포함
docker compose -f docker-compose.dev.yml logs -f -t backend
```

### 상태·리소스: `ps`, `top`, `stats`

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml ps -a   # 종료된 것까지

docker top react-auth-api-dev          # 컨테이너 안 프로세스
docker stats                           # 실시간 CPU/메모리 (전체)
docker stats react-auth-api-dev react-auth-db-dev
```

### 시작·중지·재시작

```bash
# 서비스만 재시작 (이미지 다시 빌드는 안 함)
docker compose -f docker-compose.dev.yml restart backend

docker compose -f docker-compose.dev.yml stop
docker compose -f docker-compose.dev.yml start

# 설정/이미지를 바꾼 뒤 재생성
docker compose -f docker-compose.dev.yml up -d --force-recreate backend
```

### 빌드·이미지

```bash
docker compose -f docker-compose.dev.yml build backend
docker compose -f docker-compose.dev.yml build --no-cache backend
docker compose -f docker-compose.dev.yml pull db   # 이미지가 레지스트리에서 올 때
docker images | findstr react-auth                 # Windows: 로컬 이미지 확인
```

### `inspect` — 포트·환경·마운트 확인

```bash
docker inspect react-auth-api-dev --format '{{json .NetworkSettings.Ports}}'
docker inspect react-auth-api-dev
```

JSON이 길면 `--format`으로 필요한 필드만 뽑는 편이 읽기 쉽습니다.

### `cp` — 호스트 ↔ 컨테이너 파일 복사

```bash
docker cp react-auth-api-dev:/app/package.json ./package.json.from-container
docker cp ./local.file react-auth-api-dev:/app/tmp/
```

업로드 볼륨을 쓰는 경우 대부분은 호스트의 `backend/` 마운트로 충분하고, `cp`는 일회성 복구·점검용으로 두면 됩니다.

### `run` — 일회성 컨테이너 (DB 클라이언트 등)

`exec`와 달리 **새 컨테이너**를 띄웁니다. 같은 Compose 네트워크에 붙이려면 네트워크 이름이 필요합니다.

```bash
docker network ls   # react-auth-dev_default 같은 이름 확인 후
docker run --rm -it --network react-auth-dev_default postgres:16-alpine \
  psql -h db -U reactauth -d reactauth
```

네트워크 이름은 프로젝트 폴더명·Compose `name:`에 따라 달라지므로 `docker network ls`로 확인하는 것이 안전합니다.

### 정리·디스크 (`prune` 등)

```bash
docker compose -f docker-compose.dev.yml down -v   # 이 프로젝트 볼륨까지 삭제 (DB 데이터 초기화)
docker system df                                   # 디스크 사용량 요약
docker builder prune                               # 빌드 캐시 정리
docker system prune                                # 사용 안 하는 네트워크·중단 컨테이너 등 (주의)
```

`system prune`은 다른 프로젝트의 중지 컨테이너까지 지울 수 있으므로, 공유 PC에서는 옵션(`-a`, `--volumes`)을 꼭 읽고 실행합니다.

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

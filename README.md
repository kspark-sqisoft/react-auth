# react-auth

NestJS + React(Vite) 풀스택 **인증·게시글·북·채팅** 등을 포함한 학습·실습용 저장소입니다. JWT 액세스 토큰 + httpOnly 리프레시 쿠키, PostgreSQL(TypeORM), 역할 기반 접근 제어(`user` / `admin`)를 사용합니다.

---

## 한눈에 보기

| 영역 | 설명 |
|------|------|
| **백엔드** | `backend/` — NestJS 11, TypeORM, Passport JWT, Swagger `http://localhost:3000/api-docs` |
| **프론트** | `frontend/` — React 19, Vite, TanStack Query, React Router, shadcn/ui 계열 |
| **DB** | PostgreSQL(로컬·Docker). 개발 시 `TYPEORM_SYNC`로 스키마 자동 맞춤 가능 |
| **문서** | [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md) — 모듈·API·RBAC·북 편집기 등 |
| **Docker** | [docs/DOCKER.md](docs/DOCKER.md) — Compose 파일별 실행 방법 |

---

## 빠른 시작 (Docker 개발 스택)

저장소 **루트**에서:

```bash
docker compose -f docker-compose.dev.yml up --build
```

| 서비스 | URL |
|--------|-----|
| 프론트 (Vite) | http://localhost:5173 또는 http://localhost:8080 |
| API | http://localhost:3000 |
| Postgres | `localhost:5432` (기본 계정: `reactauth` / DB: `reactauth`) |
| Swagger | http://localhost:3000/api-docs |

중지: `docker compose -f docker-compose.dev.yml down`  
볼륨까지 삭제: `... down -v`

자세한 옵션(DB만 띄우기, 운영용 Compose 등)은 [docs/DOCKER.md](docs/DOCKER.md)를 참고합니다.

---

## 로컬에서만 실행 (요약)

1. **Postgres**를 띄운 뒤 `backend/.env`에 `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` 등을 설정합니다. 예시는 `backend/.env.example`을 따릅니다.
2. **백엔드**

   ```bash
   cd backend
   npm ci
   npm run start:dev
   ```

3. **프론트** — 개발 시 Vite가 `/auth`, `/users`, `/posts` 등을 API로 프록시합니다(`frontend/vite.config.ts`).

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

프론트만 다른 오리진에서 빌드해 쓸 때는 `VITE_API_BASE_URL`로 API 베이스 URL을 지정합니다.

---

## 주요 기능

- **인증**: 회원가입·로그인, 액세스 JWT(sessionStorage), 리프레시 쿠키·로테이션, 로그아웃
- **역할(RBAC)**: 일반 사용자 / 관리자 — DB `User.role`, 가드·도메인 정책·내 정보 화면에서 타 사용자 역할 관리
- **게시글**: 목록(커서)·상세, 첨부 이미지·동영상, 좋아요, 트리 댓글
- **북(Book)**: 슬라이드 편집기, 캔버스 위젯, 업로드, 레이아웃 AI(OpenAI)·대화 DB 저장
- **채팅**: Socket.IO `/chat`
- **기타**: 날씨·뉴스 프록시, Cats 학습용 CRUD 등

RBAC·엔드포인트 상세는 [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md)의 RBAC(역할) 섹션을 보세요.

---

## 디렉터리 구조 (요약)

```
react-auth/
├── backend/           # NestJS API
├── frontend/          # Vite + React SPA
├── docs/
│   ├── PROJECT_ARCHITECTURE.md
│   └── DOCKER.md
├── docker-compose.dev.yml
├── docker-compose.yml
└── README.md          # 본 파일
```

---

## 프론트엔드 추가 참고 (Vite 템플릿)

`frontend/`는 Vite React TS 템플릿을 기반으로 확장되었습니다. **React Compiler·ESLint 타입 인식 설정** 등 템플릿 원문 안내는 다음을 참고하세요.

→ [frontend/README.md](frontend/README.md)

---

## 개발 시 유용한 명령

| 위치 | 명령 | 설명 |
|------|------|------|
| `backend/` | `npm run start:dev` | Nest watch 모드 |
| `backend/` | `npm test` | 단위 테스트 |
| `backend/` | `npm run seed:posts` | 개발용 글 시드(반복 시 누적) |
| `frontend/` | `npm run dev` | Vite 개발 서버 |
| `frontend/` | `npm run build` | 프로덕션 빌드 |

---

## 라이선스

저장소 루트의 `LICENSE` 또는 각 패키지 설정을 따릅니다.

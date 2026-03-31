# react-auth 프로젝트 아키텍처 & 기능 가이드

> 백엔드(NestJS) · 프론트엔드(React + Vite) · SQLite(TypeORM) 기반 풀스택 앱의 구조, 엔티티, API, 주요 사용자 흐름을 한곳에 정리한 문서입니다.

**유지보수:** API·라우트·페이징(무한 스크롤 포함)·엔티티 등 이 문서에 대응하는 코드가 바뀌면, 변경과 **같은 작업**에서 이 파일도 수정하거나 필요한 절을 추가한다. 에이전트·기여자용 자동 안내는 `.cursor/rules/docs-architecture-sync.mdc`를 본다.

---

## 목차

1. [한눈에 보기](#1-한눈에-보기)
2. [기술 스택](#2-기술-스택)
3. [시스템 구성도](#3-시스템-구성도)
4. [데이터 모델 (엔티티)](#4-데이터-모델-엔티티)
5. [백엔드 모듈 & API](#5-백엔드-모듈--api)
6. [프론트엔드 라우팅 & 화면](#6-프론트엔드-라우팅--화면)
7. [주요 비즈니스 흐름](#7-주요-비즈니스-흐름)
8. [북(Book) 편집기 심화](#8-북book-편집기-심화)
9. [디렉터리 구조 (요약)](#9-디렉터리-구조-요약)
10. [개발·배포 시 참고](#10-개발배포-시-참고)

---

## 1. 한눈에 보기

| 영역 | 역할 |
|------|------|
| **인증** | 회원가입/로그인, JWT 액세스·리프레시, HttpOnly 쿠키 기반 갱신 |
| **게시글(Posts)** | 목록·상세, 작성/수정(보호), 첨부(이미지·동영상), 좋아요, 댓글(트리) |
| **북(Books)** | 슬라이드형 문서, 캔버스 위젯, 미디어 업로드, **레이아웃 AI**(OpenAI), **AI 대화 DB 저장** |
| **채팅(Chat)** | Socket.IO 네임스페이스 `/chat`, 로비·사용자 방, 메시지 영속화 |
| **날씨** | 위젯용 현재 날씨 API 프록시 |
| **뉴스** | 북 편집기 뉴스 위젯용 [NewsAPI](https://newsapi.org/) 헤드라인 프록시 (`NEWSAPI_KEY`) |
| **Cats** | 학습용 CRUD (`study_cats` 테이블) |
| **사용자** | 내 정보 조회/수정, 아바타 |

---

## 2. 기술 스택

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
  subgraph Client["프론트엔드"]
    Vite[Vite]
    React[React 19]
    RQ[TanStack Query]
    RTR[React Router]
    Axios[Axios + 쿠키]
  end
  subgraph Server["백엔드"]
    Nest[NestJS]
    ORM[TypeORM]
    JWT[JWT / Passport]
    SIO[Socket.IO]
  end
  subgraph Data["데이터"]
    SQLite[(SQLite)]
    Uploads[uploads/ 파일]
  end
  Client --> Server
  Server --> SQLite
  Server --> Uploads
  Client -. WebSocket .-> SIO
```

| 계층 | 기술 |
|------|------|
| UI | React, Tailwind CSS, shadcn/ui 계열 컴포넌트 |
| 빌드 | Vite, TypeScript |
| API 클라이언트 | Axios, `withCredentials` |
| 서버 | NestJS 11, class-validator, Swagger (`/api` 등) |
| DB | SQLite, TypeORM (`synchronize: true` — **개발용**) |
| 실시간 | Socket.IO (`/chat`) |
| 외부 연동 | OpenAI Chat Completions(북 AI), Pexels(이미지·영상 검색), NewsAPI(뉴스 위젯 헤드라인) |

---

## 3. 시스템 구성도

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart TB
  subgraph Browser["브라우저"]
    FE[React SPA]
    ChatWS[ChatDock WebSocket]
  end
  FE -->|REST /api| API[Nest HTTP]
  ChatWS -->|/socket.io| GW[ChatGateway]
  API --> AuthM[Auth / Users]
  API --> PostsM[Posts]
  API --> BooksM[Books + AI]
  API --> CatsM[Cats]
  API --> WxM[Weather]
  API --> NewsM[News]
  AuthM --> DB[(SQLite)]
  PostsM --> DB
  BooksM --> DB
  CatsM --> DB
  GW --> ChatSvc[ChatService]
  ChatSvc --> DB
  BooksM --> OAI[OpenAI API]
  BooksM --> PX[Pexels API]
  NewsM --> NAPI[NewsAPI.org]
```

---

## 4. 데이터 모델 (엔티티)

### 4.1 ER 개요

```mermaid
erDiagram
  User ||--o{ Post : writes
  User ||--o{ Book : owns
  User ||--o{ RefreshToken : has
  Post ||--o{ PostAttachment : has
  Post ||--o{ PostLike : has
  Post ||--o{ PostComment : has
  Book ||--o{ BookPage : contains
  Book ||--o{ BookAiChatMessage : "ai chat"
  ChatRoom {
    string roomId UK
    int ownerId
  }
  ChatMessage {
    string roomId
    int authorId
    text body
  }
  Cat {
    string name
    int age
  }
  User {
    int id PK
    string email UK
    string password
  }
  Book {
    int id PK
    string title
    int slideWidth
    int slideHeight
  }
  BookPage {
    int id PK
    int sortOrder
    text elementsJson
  }
  BookAiChatMessage {
    int id PK
    string role
    text body
  }
```

### 4.2 엔티티 요약표

| 엔티티 | 테이블(기본) | 핵심 필드 / 관계 |
|--------|----------------|------------------|
| `User` | `user` | email(유니크), name, password, profileImageFilename |
| `RefreshToken` | `refresh_token` | userId, tokenHash(SHA-256), expiresAt |
| `Post` | `post` | title, content, author → User |
| `PostAttachment` | `post_attachment` | postId, kind(image\|video), fileFilename, posterFilename |
| `PostLike` | `post_like` | post + user 유니크 |
| `PostComment` | `post_comment` | post, author, parent(트리) |
| `Book` | `book` | title, slideWidth/Height, author → User |
| `BookPage` | `book_page` | book, sortOrder, slideName, **elementsJson**, backgroundColor |
| `BookAiChatMessage` | `book_ai_chat_message` | book → CASCADE, role(user\|assistant), body |
| `ChatRoom` | `chat_room` | roomId(유니크), ownerId |
| `ChatMessage` | `chat_message` | roomId, authorId, body, 인덱스(roomId, createdAt) |
| `Cat` | `study_cats` | name, age, breed |

> **북 캔버스 요소**는 `BookPage.elementsJson`에 JSON 배열로 저장됩니다. 타입·필드 정의는 프론트 `book-canvas.ts` 및 백엔드 `books.service` 검증 로직과 맞춥니다.

---

## 5. 백엔드 모듈 & API

### 5.1 모듈 맵

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart LR
  App[AppModule]
  App --> Users[UsersModule]
  App --> Auth[AuthModule]
  App --> Posts[PostsModule]
  App --> Books[BooksModule]
  App --> Chat[ChatModule]
  App --> Weather[WeatherModule]
  App --> News[NewsModule]
  App --> Cats[CatsModule]
  Books --> BookAI[BookAiService / Pexels]
  Books --> BooksAIController["books/ai/*"]
```

### 5.2 HTTP API 요약

**인증** — `@Controller('auth')`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/auth/signup` | 회원가입 |
| POST | `/auth/signin` | 로그인(쿠키 설정) |
| POST | `/auth/refresh` | 액세스 토큰 갱신 |
| POST | `/auth/logout` | 로그아웃 |

**사용자** — JWT 필요 구간 있음

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/users/me` | 내 프로필 |
| PATCH | `/users/me` | 내 정보 수정 |

**게시글** — `@Controller('posts')`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/posts` | 목록(**커서**·`cursor`/`nextCursor`/`hasMore`), Bearer 시 likedByMe; 첫 응답에만 `total` |
| GET | `/posts/:id` | 상세 |
| GET | `/posts/:id/comments` | 댓글 트리 |
| POST | `/posts/:id/like` | 좋아요 (JWT) |
| DELETE | `/posts/:id/like` | 좋아요 취소 (JWT) |
| POST | `/posts/:id/comments` | 댓글 작성 (JWT) |
| DELETE | `/posts/:id/comments/:commentId` | 댓글 삭제 (JWT) |
| PATCH | `/posts/:id` | 수정 (JWT) |
| DELETE | `/posts/:id` | 삭제 (JWT) |

**북** — `@Controller('books')`

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/books` | 목록(페이지·검색) |
| GET | `/books/:id` | 상세(페이지·요소) |
| POST | `/books` | 생성 (JWT) |
| PATCH | `/books/:id` | 수정 (작성자, JWT) |
| DELETE | `/books/:id` | 삭제 (작성자, JWT) |
| POST | `/books/:id/upload` | 이미지/동영상 업로드 (JWT) |

**북 AI** — `@Controller('books/ai')` (전역 JWT)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/books/ai/chat?bookId=` | 해당 북 AI 대화 기록(작성자, 최대 200줄) |
| POST | `/books/ai/layout` | 자연어 → 레이아웃 JSON 액션(OpenAI). `bookId` 선택 시 **성공 턴**을 DB에 저장 |

**기타**

| 컨트롤러 | 대표 엔드포인트 |
|----------|-----------------|
| `WeatherController` | `GET /weather/current`, `GET /weather/seoul` |
| `NewsController` | `GET /news/headlines` — 쿼리 `country`, 선택 `category`, `pageSize`(1–10); 서버 `NEWSAPI_KEY` 필요 |
| `CatsController` | `GET/POST/DELETE /cats`, `GET /cats/:id` |
| `AppController` | `GET /` 헬스 등 |

> HTTP API는 기본적으로 **루트 경로**에 마운트됩니다. Swagger UI: **`/api-docs`** (포트는 `backend` 설정 참고).

### 5.3 WebSocket 채팅

- 네임스페이스: **`/chat`**
- 클라이언트: `io(apiOrigin + '/chat', { path: '/socket.io', auth: { token } })`
- 주요 이벤트(개념): 방 입장/퇴장, 메시지 전송, 히스토리 로드, 방 목록 등 (`ChatGateway`, `ChatDock.tsx` 참고)

---

## 6. 프론트엔드 라우팅 & 화면

### 6.1 라우트 다이어그램

```mermaid
%%{init: {'theme': 'neutral'}}%%
flowchart TB
  subgraph Public["공개"]
    H["/ 홈"]
    L["/login /signup"]
    PL["/posts 목록"]
    PD["/posts/:id 상세"]
    BL["/books 목록"]
    BD["/books/:id 상세·편집"]
    C["/cats /cats/:id"]
  end
  subgraph Protected["ProtectedRoute"]
    PN["/posts/new /posts/:id/edit"]
    BN["/books/new"]
    ME["/me"]
  end
```

| 경로 | 페이지 | 비고 |
|------|--------|------|
| `/` | `HomePage` | 랜딩 |
| `/login`, `/signup` | 로그인·가입 | |
| `/posts` | `PostListPage` | 무한 스크롤·**커서 API** (아래 **6.3절** 참고) |
| `/posts/:id` | `PostDetailPage` | 공개 |
| `/posts/new`, `/posts/:id/edit` | `PostEditorPage` | 로그인 필요 |
| `/books` | `BookListPage` | 무한 스크롤 UI이나 API는 **`skip`/`take`/`total`** (6.3절) |
| `/books/new` | `BookEditorPage` | 로그인 필요, 저장 후 상세로 이동 가능 |
| `/books/:id` | `BookDetailPage` | 공개 URL; 작성자면 편집 UI, 비작성자는 보기·레이어 패널·**미리보기(슬라이드쇼)** |
| `/books/:id/preview` | `BookPresentationPage` | 공개; 전체 화면 슬라이드쇼(작성자 여부 무관). 맞춤·줌은 `BOOK_CANVAS_PRESENTATION_DISPLAY_OPTS`(`symmetricVerticalPad`로 상·하 동일 여백 반영, 확대 허용) — 편집 스테이지는 `BOOK_CANVAS_STAGE_DISPLAY_OPTS`(maxFit 1) |
| `/books/:id/edit` | → `/books/:id` 리다이렉트 | 레거시 |
| `/me` | `MyInfoPage` | |
| `/cats`, `/cats/:id` | Cats 데모 | |

### 6.2 공통 UI

- `AppLayout`: 헤더·채팅 독(`ChatDock`) 등 껍데기
- `ProtectedRoute`: 비로그인 시 로그인으로 이동
- API 래퍼: `frontend/src/lib/api.ts` (토큰·에러 처리)

### 6.3 공부용: 무한 스크롤·목록 페이징 (posts만 방식이 다름)

같은 “아래로 스크롤하면 더 불러오기” UX라도, **백엔드 페이징 모델은 글(posts)만 커서 기반**으로 구현해 두었습니다. 나머지는 비교·학습용으로 다른 패턴을 그대로 둡니다.

| 구분 | 화면 | 프론트 | 백엔드 목록 API |
|------|------|--------|-----------------|
| **글** | `PostListPage` | `useInfiniteQuery`, `pageParam` = 이전 응답의 **`nextCursor`** 문자열(첫 요청은 생략) | `GET /posts?take=&search=&cursor=` — **`cursor` / `nextCursor` / `hasMore`**, 정렬 `createdAt DESC`, `id DESC`로 안정적 이어붙임. **`total`은 cursor 없는 첫 응답에만** 포함 |
| 북 | `BookListPage` | `useInfiniteQuery`, `pageParam` = 지금까지 로드한 개수(**오프셋 `skip`**) | `GET /books?skip=&take=` … **`skip`·`take`·`total`** 전통적 페이지네이션 |
| 캣츠 | `CatsPage` | `useQuery`로 **목록 전체 한 번** 로드 | `GET /cats` 전체(데모 규모 가정) |

정리하면, **무한 스크롤 “데이터 이어붙이기” 구현을 커서 방식으로 쓰는 곳은 posts 뿐**이고, books는 오프셋+`total`로 다음 페이지를 잡습니다. 실무에서는 데이터가 커지면 북 목록도 커서로 바꾸는 선택지가 있습니다.

---

## 7. 주요 비즈니스 흐름

### 7.1 로그인 & API 호출 (개념)

```mermaid
%%{init: {'theme': 'neutral'}}%%
sequenceDiagram
  participant U as 사용자
  participant FE as React
  participant API as Nest API
  participant DB as SQLite
  U->>FE: 로그인 제출
  FE->>API: POST /auth/signin
  API->>DB: 사용자 검증
  API-->>FE: Set-Cookie (액세스/리프레시 등)
  FE->>API: 이후 요청 withCredentials
  API-->>FE: 401 시 클라이언트에서 refresh 시도 패턴
```

### 7.2 북 저장 흐름

```mermaid
%%{init: {'theme': 'neutral'}}%%
sequenceDiagram
  participant FE as BookDetailPage
  participant API as PATCH /books/:id
  participant DB as SQLite
  FE->>FE: 로컬 pages + elements 편집
  FE->>API: 제목·slide 크기·pages 배열
  API->>DB: Book + BookPage 갱신
  API-->>FE: BookDetail
```

### 7.3 북 레이아웃 AI + 대화 저장

```mermaid
%%{init: {'theme': 'neutral'}}%%
sequenceDiagram
  participant P as BookAiAssistantPanel
  participant API as POST /books/ai/layout
  participant AI as OpenAI
  participant DB as SQLite
  P->>API: message + 캔버스 메타 + 선택적 bookId
  API->>AI: system + 단일 user 메시지(히스토리 미포함)
  AI-->>API: JSON reply + actions
  API->>DB: bookId 있으면 user/assistant 1턴 저장
  API-->>P: reply, actions
  P->>P: 위젯·배경·제목 등 클라이언트 적용
  Note over P,DB: 패널 재오픈 시 GET /books/ai/chat 로 복원
```

> OpenAI 요청에 **이전 대화를 넣지 않으므로**, DB에 기록만 해도 **토큰 사용량은 늘지 않습니다.** (향후 “기억”을 모델에 넣으면 그때 입력 토큰이 증가합니다.)

### 7.4 채팅(WebSocket)

```mermaid
%%{init: {'theme': 'neutral'}}%%
sequenceDiagram
  participant C as ChatDock
  participant GW as ChatGateway
  participant SVC as ChatService
  participant DB as SQLite
  C->>GW: connect JWT
  C->>GW: joinRoom
  GW-->>C: joinedRoom / history
  C->>GW: sendMessage
  GW->>SVC: append
  SVC->>DB: ChatMessage 저장
  GW-->>C: chatMessage broadcast
```

---

## 8. 북(Book) 편집기 심화

### 8.1 기능 맵 (개념)

```mermaid
mindmap
  root((북 편집기))
    슬라이드
      페이지 추가·삭제·순서
      썸네일
    캔버스
      텍스트·이미지·비디오·날씨·시계·뉴스
      그리기 레이어
      정렬·가이드
    속성
      인스펙터·레이어 패널
      리치 텍스트 툴바
    미디어
      업로드·라이브러리
    AI
      자연어 레이아웃
      대화 기록 DB
```

### 8.2 프론트 주요 파일 (참고용)

| 구역 | 대표 경로 |
|------|-----------|
| 상세·편집 통합 | `pages/BookDetailPage.tsx` |
| 신규 북 | `pages/BookEditorPage.tsx` |
| 슬라이드 캔버스 | `components/books/BookSlideCanvas.tsx` |
| AI 패널 | `components/books/BookAiAssistantPanel.tsx` |
| 캔버스 타입·도구 | `lib/book-canvas.ts`, `lib/book-text-widget.ts` |
| 슬라이드 템플릿(사이니지) | `lib/book-slide-templates.ts` — 카테고리: 메뉴·공지·**실생활**·뉴스·비주얼 |
| AI 배치 해석 | `lib/book-ai-placement.ts` |

---

## 9. 디렉터리 구조 (요약)

```
react-auth/
├── backend/                 # NestJS
│   └── src/
│       ├── auth/
│       ├── books/           # Book, BookPage, AI, Pexels, 업로드
│       ├── chat/
│       ├── posts/
│       ├── users/
│       ├── weather/
│       ├── news/            # NewsAPI 헤드라인 프록시
│       ├── cats/
│       └── main.ts
├── frontend/                # Vite + React
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── lib/             # api, book-*, query-keys …
│       └── App.tsx
└── docs/
    └── PROJECT_ARCHITECTURE.md   # 본 문서
```

---

## 10. 개발·배포 시 참고

| 항목 | 내용 |
|------|------|
| DB 스키마 | `app.module.ts`에서 `synchronize: true` — **운영에서는 마이그레이션 + synchronize 끄기 권장** |
| 비밀 값 | `backend/.env`, `frontend/.env` — 예시는 각 `.env.example` |
| 북 AI | `OPENAI_API_KEY`, 선택 `OPENAI_MODEL`; Pexels 키는 서버 설정에 따름 |
| 뉴스 위젯 | `NEWSAPI_KEY` — [NewsAPI](https://newsapi.org/) 개발자 키 |
| 정적·업로드 | `uploads/` 아바타·북 미디어·글 첨부 등 |
| 글 시드(개발) | `backend`에서 `npm run seed:posts` — 가장 오래된 사용자에게 IT 주제 글 20개 삽입(무한 스크롤 테스트용). **재실행 시 20개씩 추가** |

---

### 문서 버전

- 저장소: **react-auth**
- 생성 기준: 코드 트리의 모듈·엔티티·라우트·주요 컴포넌트를 반영한 개요 문서입니다. 세부 DTO·쿼리 파라미터는 **Swagger**와 각 `*.controller.ts`를 함께 보시면 가장 정확합니다.

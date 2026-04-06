/**
 * 개발용: IT 주제 글 20개를 가장 오래된 사용자에게 연결해 삽입합니다.
 * 각 글에는 `post-categories.ts` 중 하나가 무작위로 배정됩니다.
 *
 * 실행: backend 디렉터리에서 `npm run seed:posts` (PostgreSQL 가동·`.env` DB 설정 필요)
 */
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { typeOrmRootOptions } from '../src/typeorm-root.options';
import { randomPostCategory } from '../src/posts/post-categories';
import { Post } from '../src/posts/post.entity';
import { User } from '../src/users/user.entity';

const ROWS: { title: string; content: string }[] = [
  {
    title: 'React Query useInfiniteQuery로 목록 이어붙이기',
    content:
      '<p>첫 페이지는 <code>initialPageParam</code>으로 비우고, 서버가 준 <code>nextCursor</code>를 다음 요청에 넘기면 됩니다. 검색어가 바뀌면 쿼리 키를 바꿔 캐시를 초기화하는 패턴이 흔합니다.</p>',
  },
  {
    title: 'REST 목록 API: 오프셋 vs 커서',
    content:
      '<p><code>skip</code>/<code>take</code>는 구현이 단순하지만 중간에 글이 추가되면 같은 페이지를 다시 볼 수 있습니다. 커서는 정렬 키(예: 생성일+id) 기준이라 대량 피드에 더 잘 맞습니다.</p>',
  },
  {
    title: 'TypeScript에서 unknown을 먼저 좁히기',
    content:
      '<p>API 응답이나 <code>JSON.parse</code> 결과는 <code>unknown</code>으로 받고, 타입 가드나 스키마 검증(zod 등)으로 안전하게 필드를 확인한 뒤 사용하는 습관이 런타임 오류를 줄입니다.</p>',
  },
  {
    title: 'NestJS에서 OptionalJwtAuthGuard 쓰는 이유',
    content:
      '<p>목록·상세처럼 공개지만, 로그인 시에만 채워지는 필드(예: 좋아요 여부)가 있을 때 선택 JWT 가드로 동일 엔드포인트에서 분기할 수 있습니다.</p>',
  },
  {
    title: 'PostgreSQL + TypeORM synchronize는 개발 전용',
    content:
      '<p>스키마를 자동 맞춰 주어 편하지만, 운영에서는 마이그레이션으로 버전 관리하고 <code>TYPEORM_SYNC=false</code>로 두는 것이 안전합니다.</p>',
  },
  {
    title: 'Vite 환경 변수는 VITE_ 접두사',
    content:
      '<p>브라우저에 노출되는 값만 <code>import.meta.env.VITE_*</code>로 쓰고, 비밀 키는 반드시 서버( Nest 설정 등 )에만 두는 구조가 기본입니다.</p>',
  },
  {
    title: 'debounce와 throttle 차이 한 줄 정리',
    content:
      '<p>검색 입력은 연속 타이핑 끝난 뒤 한 번만 호출하려면 debounce, 스크롤 위치 감시처럼 일정 간격으로만 처리하려면 throttle을 고려합니다.</p>',
  },
  {
    title: 'CORS와 쿠키 기반 JWT',
    content:
      '<p>프론트와 API 도메인·포트가 다르면 <code>credentials: include</code>와 서버의 <code>Access-Control-Allow-Origin</code>을 정확히 맞춰야 HttpOnly 쿠키가 붙습니다.</p>',
  },
  {
    title: 'ESLint react-hooks 규칙과 의존성 배열',
    content:
      '<p><code>useEffect</code> 안에서 쓰는 값은 배열에 넣거나, 이벤트 핸들러로 옮겨 stale closure를 피합니다. 무한 루프가 나면 “의존성이 과한가?”부터 봅니다.</p>',
  },
  {
    title: 'Git 커밋 메시지는 왜 문장으로 쓰나',
    content:
      '<p>나중에 로그만 읽어도 “무엇을·왜” 바꿨는지 드러나야 합니다. 티켓 번호와 한 줄 요약, 필요하면 본문에 맥락을 덧붙이는 방식이 협업에 유리합니다.</p>',
  },
  {
    title: 'Docker Compose로 풀스택 개발',
    content:
      '<p><code>docker-compose.dev.yml</code>로 DB·백엔드·프론트를 한 번에 띄우고, 소스 볼륨 마운트로 Nest/Vite 핫 리로드를 쓸 수 있습니다.</p>',
  },
  {
    title: 'Socket.IO 네임스페이스와 path',
    content:
      '<p>클라이언트는 <code>io(origin + "/chat", { path: "/socket.io" })</code>처럼 서버 설정과 동일한 path·namespace를 맞춰야 연결됩니다.</p>',
  },
  {
    title: 'bcrypt rounds와 응답 시간',
    content:
      '<p>비밀번호 해시 비용은 공격자에게도 적용되지만, 너무 높이면 가입·로그인 API가 느려집니다. 프로젝트 정책에 맞는 라운드를 문서로 고정해 두면 좋습니다.</p>',
  },
  {
    title: '프론트에서 HTML을 그대로 렌더링할 때',
    content:
      '<p>사용자 입력 HTML은 서버에서 sanitize하고, 클라이언트는 신뢰할 수 있는 소스만 <code>dangerouslySetInnerHTML</code>에 넣는 식으로 이중 방어를 생각합니다.</p>',
  },
  {
    title: 'React key는 왜 id를 쓰나',
    content:
      '<p>목록에서 인덱스를 key로 쓰면 순서 변경·삽입 시 컴포넌트 상태가 엉킬 수 있습니다. 서버가 준 안정적인 <code>id</code>가 있으면 그걸 쓰는 것이 기본입니다.</p>',
  },
  {
    title: '환경별 .env와 시크릿 관리',
    content:
      '<p>예시는 <code>.env.example</code>에만 올리고, 실제 키는 로컬·CI·배포 플랫폼의 비밀 저장소에 둡니다. 저장소에 커밋되면 회전(재발급)이 필요합니다.</p>',
  },
  {
    title: 'E2E 테스트에서 데이터 격리',
    content:
      '<p>테스트 DB를 분리하거나, 각 스위트 전후로 시드를 밀고 넣는 방식으로 서로 다른 테스트가 같은 행에 의존하지 않게 합니다.</p>',
  },
  {
    title: 'OpenAPI(Swagger)와 실제 동작 맞추기',
    content:
      '<p>데코레이터로 문서를 유지하면 프론트·모바일과 계약 논의가 쉬워집니다. DTO나 쿼리 파라미터가 바뀌면 Swagger 설명도 같이 고치는 습관이 좋습니다.</p>',
  },
  {
    title: '무한 스크롤 UX: 스크롤 의도 arm 패턴',
    content:
      '<p>첫 화면에서 하단 감시 요소가 보인다고 즉시 연속 요청하지 않도록, 휠·스크롤·터치 이후에만 다음 페이지를 불러오게 하는 패턴이 체감 품질에 도움이 됩니다.</p>',
  },
  {
    title: '레거시 모듈과 ESM 혼용 시 tsconfig',
    content:
      '<p><code>moduleResolution</code>과 <code>module</code> 조합에 따라 import 경로·확장자 규칙이 달라집니다. 스크립트만 CommonJS로 돌리는 별도 tsconfig를 두는 경우도 있습니다.</p>',
  },
];

async function main() {
  const base = typeOrmRootOptions() as DataSourceOptions;
  const ds = new DataSource({
    ...base,
    synchronize: false,
  });

  await ds.initialize();
  try {
    const userRepo = ds.getRepository(User);
    const postRepo = ds.getRepository(Post);

    const first = await userRepo.find({
      order: { id: 'ASC' },
      take: 1,
    });
    const author = first[0];
    if (!author) {
      console.error(
        '[seed:posts] 사용자가 없습니다. 먼저 회원가입으로 계정을 만든 뒤 다시 실행하세요.',
      );
      process.exitCode = 1;
      return;
    }

    const now = Date.now();
    const posts = ROWS.map((row, i) => {
      const createdAt = new Date(now - (ROWS.length - i) * 60_000);
      const p = postRepo.create({
        title: row.title,
        content: row.content,
        category: randomPostCategory(),
        author: { id: author.id },
      });
      p.createdAt = createdAt;
      p.updatedAt = createdAt;
      return p;
    });

    await postRepo.save(posts);
    const byCat = posts.reduce(
      (acc, p) => {
        acc[p.category] = (acc[p.category] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    console.log(
      `[seed:posts] 사용자 id=${author.id} (${author.email}) 에 글 ${posts.length}개를 넣었습니다. 카테고리 분포: ${JSON.stringify(byCat)}`,
    );
  } finally {
    await ds.destroy();
  }
}

void main();

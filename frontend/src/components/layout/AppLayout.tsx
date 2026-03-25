import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

/** 공통 헤더·푸터와 `<Outlet />`으로 자식 라우트만 갈아 끼웁니다. */
export function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-4 px-4">
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link to="/" className="text-foreground hover:text-primary">
              홈
            </Link>
            <Link to="/posts" className="text-muted-foreground hover:text-foreground">
              글
            </Link>
            {user ? (
              <Link to="/me" className="text-muted-foreground hover:text-foreground">
                내 정보
              </Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">
                  {user.name || user.email}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">로그인</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">회원가입</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="mt-auto shrink-0 border-t border-border bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="font-heading text-sm font-medium text-foreground">react-auth</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              NestJS와 React로 만든 로그인·게시판 학습 예제입니다.
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground"
            aria-label="푸터 내비게이션"
          >
            <Link to="/" className="transition-colors hover:text-foreground">
              홈
            </Link>
            <Link to="/posts" className="transition-colors hover:text-foreground">
              글
            </Link>
            {user ? (
              <Link to="/me" className="transition-colors hover:text-foreground">
                내 정보
              </Link>
            ) : (
              <>
                <Link to="/login" className="transition-colors hover:text-foreground">
                  로그인
                </Link>
                <Link to="/signup" className="transition-colors hover:text-foreground">
                  회원가입
                </Link>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}

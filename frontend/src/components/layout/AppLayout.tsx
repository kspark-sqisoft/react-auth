import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function headerNavClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-1.5 py-1 transition-colors",
    isActive
      ? "font-semibold text-primary"
      : "text-muted-foreground hover:text-foreground",
  );
}

function footerNavClass({ isActive }: { isActive: boolean }) {
  return cn(
    "transition-colors",
    isActive
      ? "font-semibold text-primary"
      : "text-muted-foreground hover:text-foreground",
  );
}

/** 공통 헤더·푸터와 `<Outlet />`으로 자식 라우트만 갈아 끼웁니다. */
export function AppLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card/40 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-4 px-4">
          <nav className="flex items-center gap-2 text-sm font-medium sm:gap-3">
            <NavLink to="/" end className={headerNavClass}>
              홈
            </NavLink>
            <NavLink to="/posts" className={headerNavClass}>
              글
            </NavLink>
          </nav>
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            {user ? (
              <>
                <Link
                  to="/me"
                  aria-label="내 정보"
                  className="flex min-w-0 max-w-[min(12rem,calc(100vw-7rem))] items-center gap-2 rounded-md py-1 pl-0.5 pr-1 text-left outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt=""
                      className="size-7 shrink-0 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold uppercase text-muted-foreground ring-1 ring-border"
                      aria-hidden
                    >
                      {(user.name || user.email).charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {user.name || user.email}
                  </span>
                </Link>
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
            <NavLink to="/" end className={footerNavClass}>
              홈
            </NavLink>
            <NavLink to="/posts" className={footerNavClass}>
              글
            </NavLink>
            {user ? (
              <NavLink to="/me" className={footerNavClass}>
                내 정보
              </NavLink>
            ) : (
              <>
                <NavLink to="/login" className={footerNavClass}>
                  로그인
                </NavLink>
                <NavLink to="/signup" className={footerNavClass}>
                  회원가입
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}

import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChatDock } from "@/components/chat/ChatDock";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
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
  const location = useLocation();
  /** 북 워크스페이스(상세·새 북 편집)만 넓게; `/books` 목록은 글 목록과 동일 `max-w-3xl` */
  const wideMain =
    location.pathname === "/books/new" || /^\/books\/\d+/.test(location.pathname);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card/40 backdrop-blur-sm">
        <div
          className={cn(
            "mx-auto flex h-12 items-center justify-between gap-4 px-4",
            wideMain ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          <nav className="flex items-center gap-2 text-sm font-medium sm:gap-3">
            <NavLink to="/" end className={headerNavClass}>
              홈
            </NavLink>
            <NavLink to="/posts" className={headerNavClass}>
              글
            </NavLink>
            <NavLink to="/books" className={headerNavClass}>
              북
            </NavLink>
          </nav>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <Link
                  to="/me"
                  aria-label="내 정보"
                  className="flex min-w-0 max-w-[min(12rem,calc(100vw-7rem))] items-center gap-2 rounded-md py-1 pl-0.5 pr-1 text-left outline-none transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <SafeImage
                    src={user.imageUrl}
                    alt=""
                    className="size-7 shrink-0 rounded-full object-cover ring-1 ring-border"
                    placeholderLabel="프로필 이미지"
                    fallback={
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold uppercase text-muted-foreground ring-1 ring-border"
                        aria-hidden
                      >
                        {(user.name || user.email).charAt(0)}
                      </span>
                    }
                  />
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
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-8",
          wideMain ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        <Outlet />
      </main>
      <footer className="mt-auto shrink-0 border-t border-border bg-card/40 backdrop-blur-sm">
        <div
          className={cn(
            "mx-auto flex flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between",
            wideMain ? "max-w-6xl" : "max-w-3xl",
          )}
        >
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
            <NavLink to="/books" className={footerNavClass}>
              북
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
      {user ? <ChatDock /> : null}
      <Toaster position="bottom-center" richColors closeButton duration={4000} />
    </div>
  );
}

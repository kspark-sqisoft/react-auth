import { startTransition, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ChatDock } from "@/components/chat/ChatDock";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
import {
  floatingDockBookSiteChromeToggleClass,
  floatingDockBookSiteFooterCollapsedStripClass,
  floatingDockBookSiteFooterCollapsedStripInnerClass,
  floatingDockBookSiteHeaderCollapsedStripClass,
  floatingDockBookSiteHeaderCollapsedStripInnerClass,
} from "@/lib/floating-dock-chrome";

const BOOK_WORKSPACE_CHROME_HEADER_KEY = "book-workspace-chrome-header-collapsed";
const BOOK_WORKSPACE_CHROME_FOOTER_KEY = "book-workspace-chrome-footer-collapsed";

function readBookChromeCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeBookChromeCollapsed(key: string, collapsed: boolean) {
  try {
    localStorage.setItem(key, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

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
  /** `BookWorkspaceShell` 사용 라우트 — 사이트 헤더 아래에 맞추려 main 패딩 제거·flex 높이 체인 */
  const bookShellRoute =
    location.pathname === "/books/new" || /^\/books\/\d+$/.test(location.pathname);
  /** 북 슬라이드쇼 미리보기 — 전체 화면에 가깝게 쓰므로 플로팅 채팅 숨김 */
  const bookPresentationPreviewRoute = /^\/books\/\d+\/preview$/.test(location.pathname);
  /** 홈: 3D 씬이 헤더~푸터 사이를 꽉 채우도록 뷰포트 높이·main flex 체인 */
  const homeRoute = location.pathname === "/";
  const fullViewportShell = bookShellRoute || homeRoute;

  const [bookSiteHeaderCollapsed, setBookSiteHeaderCollapsed] = useState(false);
  const [bookSiteFooterCollapsed, setBookSiteFooterCollapsed] = useState(false);
  const bookShellEnteredRef = useRef(false);

  useEffect(() => {
    if (!bookShellRoute) {
      bookShellEnteredRef.current = false;
      return;
    }
    if (bookShellEnteredRef.current) return;
    bookShellEnteredRef.current = true;
    startTransition(() => {
      setBookSiteHeaderCollapsed(readBookChromeCollapsed(BOOK_WORKSPACE_CHROME_HEADER_KEY));
      setBookSiteFooterCollapsed(readBookChromeCollapsed(BOOK_WORKSPACE_CHROME_FOOTER_KEY));
    });
  }, [bookShellRoute]);

  useEffect(() => {
    if (!bookShellRoute) return;
    writeBookChromeCollapsed(BOOK_WORKSPACE_CHROME_HEADER_KEY, bookSiteHeaderCollapsed);
  }, [bookShellRoute, bookSiteHeaderCollapsed]);

  useEffect(() => {
    if (!bookShellRoute) return;
    writeBookChromeCollapsed(BOOK_WORKSPACE_CHROME_FOOTER_KEY, bookSiteFooterCollapsed);
  }, [bookShellRoute, bookSiteFooterCollapsed]);

  return (
    <div
      className={cn(
        "flex flex-col bg-background text-foreground",
        /* 북·홈: 문서 스크롤 없이 뷰포트에 고정(푸터·헤더 항상 보임) */
        fullViewportShell
          ? "h-dvh max-h-dvh min-h-0 overflow-hidden"
          : "min-h-screen",
      )}
    >
      {bookShellRoute && bookSiteHeaderCollapsed ? null : (
        <header className="shrink-0 border-b border-border bg-card/40 backdrop-blur-sm">
          <div
            className={cn(
              "mx-auto flex h-12 w-full items-center justify-between gap-4 px-4",
              /* 북 풀블리드여도 내비는 홈·글·북 목록과 동일 `max-w-3xl` 컬럼에 맞춤 */
              bookShellRoute ? "max-w-3xl" : wideMain ? "max-w-6xl" : "max-w-3xl",
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
              <NavLink to="/cats" className={headerNavClass}>
                Cats
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className={floatingDockBookSiteChromeToggleClass}
                    aria-label="사이트 헤더 접기"
                    title="북 영역을 더 넓게"
                    onClick={() => setBookSiteHeaderCollapsed(true)}
                  >
                    <ChevronUp className="size-3.5" aria-hidden />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className={floatingDockBookSiteChromeToggleClass}
                    aria-label="사이트 헤더 접기"
                    title="북 영역을 더 넓게"
                    onClick={() => setBookSiteHeaderCollapsed(true)}
                  >
                    <ChevronUp className="size-3.5" aria-hidden />
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
      )}
      {bookShellRoute && bookSiteHeaderCollapsed ? (
        <div className={floatingDockBookSiteHeaderCollapsedStripClass}>
          <div className={floatingDockBookSiteHeaderCollapsedStripInnerClass}>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={floatingDockBookSiteChromeToggleClass}
              aria-label="사이트 헤더 펼치기"
              title="사이트 메뉴·계정"
              onClick={() => setBookSiteHeaderCollapsed(false)}
            >
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
      <main
        className={cn(
          "w-full flex-1",
          fullViewportShell
            ? "flex min-h-0 max-w-none flex-col overflow-hidden p-0"
            : cn(
                "mx-auto px-4 py-8",
                wideMain ? "max-w-6xl" : "max-w-3xl",
              ),
        )}
      >
        <Outlet />
      </main>
      {bookShellRoute && bookSiteFooterCollapsed ? null : (
        <footer className="mt-auto shrink-0 border-t border-border bg-card/40 backdrop-blur-sm">
          <div
            className={cn(
              "mx-auto flex w-full flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5",
              bookShellRoute
                ? "max-w-3xl"
                : wideMain
                  ? "max-w-6xl"
                  : "max-w-3xl",
            )}
          >
            <div className="space-y-0.5">
              <p className="font-heading text-xs font-medium text-foreground sm:text-sm">
                react-interactive
              </p>
              <p className="max-w-md text-[11px] leading-snug text-muted-foreground sm:text-xs">
                NestJS와 React로 짠 풀스택 학습·실험 공간입니다. JWT 로그인, 글·댓글·좋아요, 슬라이드형
                북 편집기와 레이아웃 AI, 실시간 채팅, Cats CRUD까지 한 프로젝트에서 이어집니다.
              </p>
            </div>
            <nav
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-muted-foreground sm:text-xs"
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
              <NavLink to="/cats" className={footerNavClass}>
                Cats
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
              {bookShellRoute ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={floatingDockBookSiteChromeToggleClass}
                  aria-label="사이트 푸터 접기"
                  title="북 영역을 더 넓게"
                  onClick={() => setBookSiteFooterCollapsed(true)}
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </nav>
          </div>
        </footer>
      )}
      {bookShellRoute && bookSiteFooterCollapsed ? (
        <div className={floatingDockBookSiteFooterCollapsedStripClass}>
          <div className={floatingDockBookSiteFooterCollapsedStripInnerClass}>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className={floatingDockBookSiteChromeToggleClass}
              aria-label="사이트 푸터 펼치기"
              title="푸터·내비"
              onClick={() => setBookSiteFooterCollapsed(false)}
            >
              <ChevronUp className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
      {user && !bookPresentationPreviewRoute ? <ChatDock /> : null}
      <Toaster position="bottom-center" richColors closeButton duration={4000} />
    </div>
  );
}

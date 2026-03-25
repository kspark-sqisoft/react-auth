import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { fetchPostsPage, POST_PAGE_DEFAULT, type Post } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { AuthorAvatarInline } from "@/components/posts/AuthorAvatarInline";
import { PostLikeButton } from "@/components/posts/PostLikeButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** 뷰포트 하단에서 이 픽셀 안이면 “다음 페이지”로 간주 */
const NEAR_BOTTOM_PX = 280;

/** 하단 도달 후 실제 요청까지 대기(연속 스크롤 시 타이머 리셋) */
const LOAD_MORE_DEBOUNCE_MS = 400;

/** 네트워크가 빨라도 로딩 문구·스피너가 잠깐은 보이도록 */
const LOAD_MORE_MIN_VISIBLE_MS = 350;

/** 검색어 입력 후 API 호출까지 대기 */
const SEARCH_DEBOUNCE_MS = 400;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * 공개 목록 + 무한 스크롤(사용자 스크롤 의도 후 하단 근접 시 추가 로드).
 * `loadingLock`으로 동시 요청을 막습니다.
 */
export function PostListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchRaw = searchParams.get("search") ?? "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /** 디바운스 구간: 곧 요청할 예정 */
  const [loadMoreScheduled, setLoadMoreScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likeActionError, setLikeActionError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(urlSearchRaw);
  const [searchQuery, setSearchQuery] = useState(urlSearchRaw.trim());

  /** 직전에 디바운스로 URL을 바꾼 경우, URL→입력 동기화 effect를 한 번 건너뜀 */
  const skipUrlToStateSyncRef = useRef(false);

  const postsRef = useRef(posts);
  postsRef.current = posts;

  const totalRef = useRef<number | null>(null);
  totalRef.current = total;

  const initialLoadingRef = useRef(initialLoading);
  initialLoadingRef.current = initialLoading;

  /** 스크롤/휠/터치 전에는 추가 로드하지 않음 (첫 화면에서 감시 요소가 보여도 자동 연속 요청 방지) */
  const scrollArmedRef = useRef(false);

  const loadingLock = useRef(false);
  const loadMoreDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 검색·초기 로드가 바뀌면 진행 중인 추가 로드 응답 무시 */
  const listGenerationRef = useRef(0);

  const hasMore = total !== null && posts.length < total;

  const clearLoadMoreDebounce = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
      loadMoreDebounceRef.current = null;
    }
    setLoadMoreScheduled(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchQuery(trimmed);
      skipUrlToStateSyncRef.current = true;
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (trimmed) p.set("search", trimmed);
          else p.delete("search");
          return p;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput, setSearchParams]);

  /** 브라우저 뒤로가기 등으로 URL만 바뀐 때 입력·쿼리 복원 */
  useEffect(() => {
    if (skipUrlToStateSyncRef.current) {
      skipUrlToStateSyncRef.current = false;
      return;
    }
    setSearchQuery(urlSearchRaw.trim());
    setSearchInput(urlSearchRaw);
  }, [urlSearchRaw]);

  useEffect(() => {
    clearLoadMoreDebounce();
    scrollArmedRef.current = false;
  }, [searchQuery, clearLoadMoreDebounce]);

  const fetchInitial = useCallback(async () => {
    const gen = ++listGenerationRef.current;
    setInitialLoading(true);
    try {
      const q = searchQuery || undefined;
      const { items, total: t } = await fetchPostsPage({
        skip: 0,
        take: POST_PAGE_DEFAULT,
        search: q,
      });
      if (gen !== listGenerationRef.current) return;
      setTotal(t);
      setPosts(items);
      setError(null);
      appLog("posts", "목록 초기 로드", {
        received: items.length,
        total: t,
        skip: 0,
        search: q ?? "",
      });
    } catch (e) {
      if (gen !== listGenerationRef.current) return;
      appLog("posts", "목록 로드 실패", e instanceof Error ? e.message : e);
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    } finally {
      if (gen === listGenerationRef.current) {
        setInitialLoading(false);
      }
    }
  }, [searchQuery]);

  const appendPostsPage = useCallback(async (skip: number) => {
    if (loadingLock.current) return;
    setLoadMoreScheduled(false);
    loadingLock.current = true;
    setLoadingMore(true);
    const started = Date.now();
    const genAtStart = listGenerationRef.current;
    const q = searchQuery || undefined;
    try {
      const { items, total: t } = await fetchPostsPage({
        skip,
        take: POST_PAGE_DEFAULT,
        search: q,
      });
      if (genAtStart !== listGenerationRef.current) return;
      setTotal(t);
      setPosts((prev) => [...prev, ...items]);
      setError(null);
      appLog("posts", "목록 추가 로드", {
        received: items.length,
        total: t,
        skip,
        search: q ?? "",
      });
    } catch (e) {
      if (genAtStart !== listGenerationRef.current) return;
      appLog("posts", "목록 로드 실패", e instanceof Error ? e.message : e);
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    } finally {
      loadingLock.current = false;
      const elapsed = Date.now() - started;
      await new Promise((r) =>
        setTimeout(r, Math.max(0, LOAD_MORE_MIN_VISIBLE_MS - elapsed)),
      );
      if (genAtStart === listGenerationRef.current) {
        setLoadingMore(false);
      }
    }
  }, [searchQuery]);

  const scheduleAppendPosts = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
    }
    setLoadMoreScheduled(true);
    loadMoreDebounceRef.current = setTimeout(() => {
      loadMoreDebounceRef.current = null;
      void appendPostsPage(postsRef.current.length);
    }, LOAD_MORE_DEBOUNCE_MS);
  }, [appendPostsPage]);

  const scheduleAppendPostsRef = useRef(scheduleAppendPosts);
  scheduleAppendPostsRef.current = scheduleAppendPosts;

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    return () => {
      if (loadMoreDebounceRef.current) {
        clearTimeout(loadMoreDebounceRef.current);
        loadMoreDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const pageScrollHeight = () =>
      Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );

    const checkLoadMore = () => {
      if (!scrollArmedRef.current) return;
      if (initialLoadingRef.current || loadingLock.current) return;

      const t = totalRef.current;
      if (t === null) return;
      if (postsRef.current.length >= t) return;

      const fullHeight = pageScrollHeight();
      const viewBottom = window.scrollY + window.innerHeight;
      /** 스크롤이 거의 없는 짧은 페이지: 휠/터치 한 번이면 다음 페이지 허용 */
      const shortPage = fullHeight <= window.innerHeight + NEAR_BOTTOM_PX;
      const nearBottom = viewBottom >= fullHeight - NEAR_BOTTOM_PX;
      if (!shortPage && !nearBottom) return;

      scheduleAppendPostsRef.current();
    };

    const onUserScrollIntent = () => {
      scrollArmedRef.current = true;
      queueMicrotask(checkLoadMore);
    };

    window.addEventListener("scroll", onUserScrollIntent, { passive: true });
    window.addEventListener("wheel", onUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", onUserScrollIntent, { passive: true });
    return () => {
      window.removeEventListener("scroll", onUserScrollIntent);
      window.removeEventListener("wheel", onUserScrollIntent);
      window.removeEventListener("touchmove", onUserScrollIntent);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">글 목록</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              제목·본문으로 검색할 수 있습니다. 처음 {POST_PAGE_DEFAULT}개만 불러오며, 더 보기·스크롤로
              이어서 불러옵니다.
            </p>
          </div>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="제목 또는 본문 검색…"
              className="h-9 pr-9 pl-9"
              autoComplete="off"
              aria-label="글 검색"
            />
            {searchInput ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="검색어 지우기"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  skipUrlToStateSyncRef.current = true;
                  setSearchParams(
                    (prev) => {
                      const p = new URLSearchParams(prev);
                      p.delete("search");
                      return p;
                    },
                    { replace: true },
                  );
                }}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          {searchQuery && !initialLoading && total !== null ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              검색 결과{" "}
              <span className="font-semibold tabular-nums text-foreground">{total}</span>
              건
              {posts.length < total ? (
                <>
                  {" "}
                  · 표시{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {posts.length}
                  </span>
                  건
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        {user ? (
          <Button asChild>
            <Link to="/posts/new">글 작성</Link>
          </Button>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {likeActionError ? (
        <Alert variant="destructive">
          <AlertTitle>좋아요</AlertTitle>
          <AlertDescription>{likeActionError}</AlertDescription>
        </Alert>
      ) : null}

      {initialLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      ) : null}

      {!initialLoading && posts.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">
          {searchQuery
            ? `「${searchQuery}」에 맞는 글이 없습니다.`
            : "아직 글이 없습니다."}
        </p>
      ) : null}

      <ul className="space-y-3">
        {posts.map((post) => {
          const likeButton = (
            <PostLikeButton
              postId={post.id}
              likeCount={post.likeCount}
              likedByMe={post.likedByMe}
              className="h-8 border border-border/40 bg-background/35 text-foreground shadow-sm backdrop-blur-md hover:bg-background/50"
              onPatch={(patch) => {
                setLikeActionError(null);
                setPosts((prev) =>
                  prev.map((p) => (p.id === post.id ? { ...p, ...patch } : p)),
                );
              }}
              onApplied={(state) => {
                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === post.id
                      ? {
                          ...p,
                          likeCount: state.likeCount,
                          likedByMe: state.likedByMe,
                        }
                      : p,
                  ),
                );
              }}
              onSyncError={setLikeActionError}
            />
          );

          return (
            <li key={post.id}>
              <Card className="group/card !gap-0 overflow-hidden !p-0 !py-0 transition-colors hover:bg-muted/40">
                <div
                  className={
                    post.imageUrl
                      ? "grid min-h-0 w-full grid-cols-1 sm:grid-cols-[minmax(0,1fr)_7rem] sm:grid-rows-1 sm:items-stretch sm:min-h-[7.5rem]"
                      : "grid min-h-0 w-full grid-cols-1 sm:min-h-[7.5rem]"
                  }
                >
                  <div className="relative isolate min-h-0 min-w-0">
                    <Link
                      to={`/posts/${post.id}`}
                      className={
                        post.imageUrl
                          ? "flex h-full min-h-0 min-w-0 flex-col justify-center gap-1.5 px-4 py-3 sm:py-3.5"
                          : "flex h-full min-h-[7.5rem] min-w-0 flex-col justify-center gap-1.5 px-4 py-3 pb-10 pr-14 sm:min-h-0 sm:py-3.5"
                      }
                    >
                      <h3 className="font-heading line-clamp-1 h-6 shrink-0 text-base font-semibold leading-6 text-foreground transition-colors group-hover/card:text-primary">
                        {post.title}
                      </h3>
                      <p className="flex h-8 min-h-8 shrink-0 items-center text-xs text-muted-foreground">
                        <AuthorAvatarInline author={post.author} size="xs">
                          {" "}
                          · {formatDate(post.createdAt)}
                        </AuthorAvatarInline>
                      </p>
                      <p className="line-clamp-2 h-10 max-h-10 shrink-0 overflow-hidden text-sm leading-5 break-words text-muted-foreground">
                        {post.content}
                      </p>
                    </Link>
                    {!post.imageUrl ? (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-end p-2">
                        <div className="pointer-events-auto">{likeButton}</div>
                      </div>
                    ) : null}
                  </div>
                  {post.imageUrl ? (
                    <div className="relative isolate h-28 min-h-28 w-full overflow-hidden border-border border-t sm:h-full sm:min-h-0 sm:w-full sm:border-t-0 sm:border-s max-sm:rounded-b-xl sm:rounded-e-xl sm:rounded-b-none">
                      <Link
                        to={`/posts/${post.id}`}
                        className="absolute inset-0 z-0 block overflow-hidden outline-none ring-inset ring-transparent transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`${post.title} 상세 보기`}
                      >
                        <img
                          src={post.imageUrl}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                          loading="lazy"
                        />
                      </Link>
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-end p-2">
                        <div className="pointer-events-auto">{likeButton}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <div className="flex min-h-12 flex-col items-center justify-center gap-3 py-4">
          {loadMoreScheduled || loadingMore ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <Spinner className="size-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {loadingMore
                  ? "다음 글을 불러오는 중…"
                  : "곧 다음 글을 불러옵니다…"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              스크롤하면 다음 {POST_PAGE_DEFAULT}개를 불러옵니다…
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingMore || loadMoreScheduled || initialLoading}
            onClick={() => {
              clearLoadMoreDebounce();
              void appendPostsPage(posts.length);
            }}
          >
            더 불러오기
          </Button>
        </div>
      ) : null}

      {!initialLoading && total !== null ? (
        <p className="text-center text-xs text-muted-foreground">
          {searchQuery ? (
            <>
              &quot;{searchQuery}&quot; · 총{" "}
              <span className="tabular-nums text-foreground">{total}</span>건 · 표시{" "}
              <span className="tabular-nums text-foreground">{posts.length}</span>건
            </>
          ) : (
            <>
              총 <span className="tabular-nums text-foreground">{total}</span>건 · 표시{" "}
              <span className="tabular-nums text-foreground">{posts.length}</span>건
            </>
          )}
          {!hasMore && total > 0 ? " (전부 불러옴)" : ""}
        </p>
      ) : null}
    </div>
  );
}

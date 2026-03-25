import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { fetchPostsPage, POST_PAGE_DEFAULT, type Post } from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

/** 뷰포트 하단에서 이 픽셀 안이면 “다음 페이지”로 간주 */
const NEAR_BOTTOM_PX = 280;

/** 하단 도달 후 실제 요청까지 대기(연속 스크롤 시 타이머 리셋) */
const LOAD_MORE_DEBOUNCE_MS = 400;

/** 네트워크가 빨라도 로딩 문구·스피너가 잠깐은 보이도록 */
const LOAD_MORE_MIN_VISIBLE_MS = 350;

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /** 디바운스 구간: 곧 요청할 예정 */
  const [loadMoreScheduled, setLoadMoreScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const hasMore = total !== null && posts.length < total;

  const clearLoadMoreDebounce = useCallback(() => {
    if (loadMoreDebounceRef.current) {
      clearTimeout(loadMoreDebounceRef.current);
      loadMoreDebounceRef.current = null;
    }
    setLoadMoreScheduled(false);
  }, []);

  const fetchInitial = useCallback(async () => {
    if (loadingLock.current) return;
    loadingLock.current = true;
    setInitialLoading(true);
    try {
      const { items, total: t } = await fetchPostsPage({
        skip: 0,
        take: POST_PAGE_DEFAULT,
      });
      setTotal(t);
      setPosts(items);
      setError(null);
      appLog("posts", "목록 초기 로드", {
        received: items.length,
        total: t,
        skip: 0,
      });
    } catch (e) {
      appLog("posts", "목록 로드 실패", e instanceof Error ? e.message : e);
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    } finally {
      loadingLock.current = false;
      setInitialLoading(false);
    }
  }, []);

  const appendPostsPage = useCallback(async (skip: number) => {
    if (loadingLock.current) return;
    setLoadMoreScheduled(false);
    loadingLock.current = true;
    setLoadingMore(true);
    const started = Date.now();
    try {
      const { items, total: t } = await fetchPostsPage({
        skip,
        take: POST_PAGE_DEFAULT,
      });
      setTotal(t);
      setPosts((prev) => [...prev, ...items]);
      setError(null);
      appLog("posts", "목록 추가 로드", {
        received: items.length,
        total: t,
        skip,
      });
    } catch (e) {
      appLog("posts", "목록 로드 실패", e instanceof Error ? e.message : e);
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    } finally {
      loadingLock.current = false;
      const elapsed = Date.now() - started;
      await new Promise((r) =>
        setTimeout(r, Math.max(0, LOAD_MORE_MIN_VISIBLE_MS - elapsed)),
      );
      setLoadingMore(false);
    }
  }, []);

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
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">글 목록</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            처음 {POST_PAGE_DEFAULT}개만 불러옵니다. 화면이 짧으면 휠을 한 번 굴려도 이어서
            불러오고, 길면 아래쪽으로 스크롤하면 불러옵니다.
          </p>
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

      {initialLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8 text-muted-foreground" />
        </div>
      ) : null}

      {!initialLoading && posts.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">아직 글이 없습니다.</p>
      ) : null}

      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link to={`/posts/${post.id}`}>
              <Card className="group/card gap-0 overflow-hidden p-0 py-0 transition-colors hover:bg-muted/40">
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3 sm:py-3.5">
                    <h3 className="font-heading text-base font-semibold leading-snug text-foreground transition-colors group-hover/card:text-primary">
                      {post.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {post.author.name} · {formatDate(post.createdAt)}
                    </p>
                    <p className="line-clamp-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>
                  {post.imageUrl ? (
                    <div className="relative h-28 w-full shrink-0 overflow-hidden bg-muted max-sm:rounded-e-xl sm:h-auto sm:w-28 sm:shrink-0 sm:rounded-e-xl">
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="h-full w-full object-cover sm:absolute sm:inset-0 sm:size-full"
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                </div>
              </Card>
            </Link>
          </li>
        ))}
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

      {!initialLoading && total !== null && total > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          총 {total}개 · {posts.length}개 표시
          {!hasMore ? " (전부 불러옴)" : ""}
        </p>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { fetchBook, type BookDetail } from "@/lib/api";
import { bookKeys } from "@/lib/query-keys";
import {
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  slideDisplayLabel,
} from "@/lib/book-canvas";
import {
  computeSlidePresentationDurationSec,
  DEFAULT_PRESENTATION_SLIDE_SEC,
} from "@/lib/book-presentation";
import { BookSlideCanvas } from "@/components/books/BookSlideCanvas";
import { useBookCanvasDisplayScale } from "@/lib/use-book-canvas-display-scale";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function BookPresentationInner({ bookId, data }: { bookId: number; data: BookDetail }) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const sortedPages = useMemo(() => {
    if (!data.pages?.length) return [];
    return [...data.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  const [slideIndex, setSlideIndex] = useState(0);
  const [videoDurationByElementId, setVideoDurationByElementId] = useState<
    Record<string, number>
  >({});

  const loop = data.presentationLoop !== false;
  const slideW = data.slideWidth ?? DEFAULT_SLIDE_WIDTH;
  const slideH = data.slideHeight ?? DEFAULT_SLIDE_HEIGHT;

  const maxIdx = Math.max(0, sortedPages.length - 1);
  const safeIdx = Math.min(slideIndex, maxIdx);
  const page = sortedPages[safeIdx];

  const { displayScale, zoomPercent, zoomIn, zoomOut, zoomReset, handleWheel } =
    useBookCanvasDisplayScale(canvasWrapRef, {
      slideWidth: slideW,
      slideHeight: slideH,
      bottomPad: 0,
      horizontalPad: 8,
    });

  const slideDurationSec = useMemo(() => {
    const cur = sortedPages[safeIdx];
    if (!cur) return DEFAULT_PRESENTATION_SLIDE_SEC;
    return computeSlidePresentationDurationSec(
      {
        elements: cur.elements,
        presentationTimingElementId: cur.presentationTimingElementId ?? null,
      },
      { videoDurationSecById: videoDurationByElementId },
    );
  }, [safeIdx, sortedPages, videoDurationByElementId]);

  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const tick = () =>
      setElapsedSec(
        Math.min(slideDurationSec, (performance.now() - start) / 1000),
      );
    const t = window.setInterval(tick, 100);
    queueMicrotask(tick);
    return () => clearInterval(t);
  }, [safeIdx, slideDurationSec]);
  const progressPct =
    slideDurationSec > 0 ? Math.min(100, (100 * elapsedSec) / slideDurationSec) : 0;
  const remainingSec = Math.max(0, Math.ceil(slideDurationSec - elapsedSec));

  const onVideoDurationKnown = useCallback((elementId: string, durationSec: number) => {
    setVideoDurationByElementId((prev) => {
      if (prev[elementId] === durationSec) return prev;
      return { ...prev, [elementId]: durationSec };
    });
  }, []);

  useEffect(() => {
    if (sortedPages.length === 0) return;
    const cur = sortedPages[safeIdx];
    if (!cur) return;
    const last = safeIdx >= sortedPages.length - 1;
    if (last && !loop) return;

    const sec = computeSlidePresentationDurationSec(
      {
        elements: cur.elements,
        presentationTimingElementId: cur.presentationTimingElementId ?? null,
      },
      { videoDurationSecById: videoDurationByElementId },
    );
    const ms = Math.max(500, Math.round(sec * 1000));
    const t = window.setTimeout(() => {
      setSlideIndex((i) => {
        const clamped = Math.min(i, sortedPages.length - 1);
        if (clamped + 1 < sortedPages.length) return clamped + 1;
        return loop ? 0 : clamped;
      });
    }, ms);
    return () => clearTimeout(t);
  }, [loop, safeIdx, sortedPages, videoDurationByElementId]);

  const pageTitle =
    page != null
      ? slideDisplayLabel(typeof page.name === "string" ? page.name : "", safeIdx)
      : "";

  if (sortedPages.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-muted-foreground">페이지가 없습니다.</p>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={`/books/${bookId}`}>북으로 돌아가기</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-zinc-100">
      <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-800 bg-zinc-950 px-2 py-2 sm:px-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-zinc-200" asChild>
            <Link to={`/books/${bookId}`}>
              <ArrowLeft className="mr-1.5 size-4" />
              돌아가기
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium tracking-tight text-zinc-500">{data.title}</p>
            <p className="truncate text-sm font-semibold leading-tight text-zinc-50">{pageTitle}</p>
          </div>
          <span className="shrink-0 rounded border border-zinc-700/80 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
            {safeIdx + 1} / {sortedPages.length}
          </span>
          {loop ? (
            <span className="shrink-0 text-[10px] text-zinc-500">반복</span>
          ) : (
            <span className="shrink-0 text-[10px] text-zinc-500">1회</span>
          )}
          <div className="flex shrink-0 items-center gap-px rounded-md border border-zinc-700/80 bg-zinc-900/70 p-0.5">
            <Button
              type="button"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={zoomOut}
              aria-label="축소"
            >
              −
            </Button>
            <span className="min-w-[2.75rem] text-center text-[10px] tabular-nums text-zinc-400">
              {zoomPercent}%
            </span>
            <Button
              type="button"
              variant="ghost"
              className="h-7 w-7 shrink-0 p-0 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={zoomIn}
              aria-label="확대"
            >
              +
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              onClick={zoomReset}
            >
              맞춤
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="h-2 min-h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="이 슬라이드 남은 시간 비율"
          >
            <div
              className="h-full rounded-full bg-emerald-500/90 transition-[width] duration-100 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-[11px] text-zinc-400">
            {remainingSec}초 · {slideDurationSec}초
          </span>
        </div>
      </header>
      <div
        ref={canvasWrapRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-1 pb-1 pt-0"
        onWheel={handleWheel}
      >
        {page ? (
          <BookSlideCanvas
            pageWidth={slideW}
            pageHeight={slideH}
            pageBackgroundColor={
              typeof page.backgroundColor === "string" && page.backgroundColor.trim()
                ? page.backgroundColor.trim()
                : DEFAULT_PAGE_BACKGROUND
            }
            scale={displayScale}
            elements={page.elements}
            mode="view"
            selectedIds={[]}
            onSelect={() => undefined}
            onElementChange={() => undefined}
            onVideoDurationKnown={onVideoDurationKnown}
          />
        ) : null}
      </div>
    </div>
  );
}

export function BookPresentationPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);

  const { data, isPending, error, isSuccess } = useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-muted-foreground">
        잘못된 북 주소입니다.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="size-5" />
        불러오는 중…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "북을 불러오지 못했습니다."}
        </p>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/books">목록으로</Link>
        </Button>
      </div>
    );
  }

  if (!isSuccess) {
    return null;
  }

  return <BookPresentationInner key={`${id}-${data.updatedAt}`} bookId={id} data={data} />;
}

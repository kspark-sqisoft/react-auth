import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import "@/book-presentation-transitions.css";
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
import {
  clampBookPresentationTransitionMs,
  normalizeBookPresentationTransition,
  type BookPresentationTransitionId,
} from "@/lib/book-presentation-transition";
import { BookSlideCanvas } from "@/components/books/BookSlideCanvas";
import {
  BOOK_CANVAS_PRESENTATION_DISPLAY_OPTS,
  type BookCanvasDisplayFitMode,
  useBookCanvasDisplayScale,
} from "@/lib/use-book-canvas-display-scale";
import { bookCanvasStageMatClass } from "@/lib/book-workspace-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

function requestPresentationFullscreen(el: HTMLElement) {
  const wk = el as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (typeof el.requestFullscreen === "function") {
    return el.requestFullscreen();
  }
  if (typeof wk.webkitRequestFullscreen === "function") {
    return Promise.resolve(wk.webkitRequestFullscreen());
  }
  return Promise.reject(new Error("fullscreen_unsupported"));
}


function BookPresentationInner({ bookId, data }: { bookId: number; data: BookDetail }) {
  /** 전체 화면 API 대상(헤더 제외, 슬라이드 영역만) */
  const presentationFsTargetRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const sortedPages = useMemo(() => {
    if (!data.pages?.length) return [];
    return [...data.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  const [slideIndex, setSlideIndex] = useState(0);
  /** 슬라이드 인덱스가 바뀐 횟수(첫 화면 제외) — 전환 애니메이션 트리거용 */
  const [slideNavEpoch, setSlideNavEpoch] = useState(0);
  const skipNextSlideEnterAnimationRef = useRef(true);
  /** 수동 이전/다음 시 자동 재생 타이머 리셋(첫 슬라이드·메타 로드 직후 레이스 완화) */
  const [manualNavEpoch, setManualNavEpoch] = useState(0);
  const [videoDurationByElementId, setVideoDurationByElementId] = useState<
    Record<string, number>
  >({});

  const loop = data.presentationLoop !== false;
  const slideW = data.slideWidth ?? DEFAULT_SLIDE_WIDTH;
  const slideH = data.slideHeight ?? DEFAULT_SLIDE_HEIGHT;

  const maxIdx = Math.max(0, sortedPages.length - 1);
  const safeIdx = Math.min(slideIndex, maxIdx);
  const page = sortedPages[safeIdx];

  const reduceMotion = useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  useEffect(() => {
    if (skipNextSlideEnterAnimationRef.current) {
      skipNextSlideEnterAnimationRef.current = false;
      return;
    }
    queueMicrotask(() => {
      setSlideNavEpoch((n) => n + 1);
    });
  }, [safeIdx]);

  const incomingTransition: BookPresentationTransitionId = page
    ? normalizeBookPresentationTransition(page.presentationTransition)
    : "none";
  const transitionMs = page
    ? clampBookPresentationTransitionMs(page.presentationTransitionMs)
    : 450;
  const runSlideEnterAnimation =
    slideNavEpoch > 0 &&
    incomingTransition !== "none" &&
    !reduceMotion;

  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [fsDialogOpen, setFsDialogOpen] = useState(false);
  const [fsFitDraft, setFsFitDraft] =
    useState<BookCanvasDisplayFitMode>("contain");
  const [fsFitMode, setFsFitMode] =
    useState<BookCanvasDisplayFitMode>("contain");

  useEffect(() => {
    const sync = () => {
      const el = presentationFsTargetRef.current;
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      const active =
        document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsBrowserFullscreen(Boolean(el && active === el));
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const displayScaleOpts = useMemo(
    () => ({
      slideWidth: slideW,
      slideHeight: slideH,
      ...(isBrowserFullscreen
        ? {
            ...BOOK_CANVAS_PRESENTATION_DISPLAY_OPTS,
            symmetricVerticalPad: 0,
            horizontalPad: 0,
            fitMode: fsFitMode,
          }
        : {
            ...BOOK_CANVAS_PRESENTATION_DISPLAY_OPTS,
            fitMode: "contain" as const,
          }),
    }),
    [slideW, slideH, isBrowserFullscreen, fsFitMode],
  );

  const {
    displayScale,
    zoomPercent,
    zoomIn,
    zoomOut,
    zoomReset,
    handleWheel,
    layoutAvail,
  } = useBookCanvasDisplayScale(canvasWrapRef, displayScaleOpts);

  const confirmEnterFullscreen = useCallback(() => {
    setFsFitMode(fsFitDraft);
    setFsDialogOpen(false);
    queueMicrotask(() => {
      const el = presentationFsTargetRef.current;
      if (!el) return;
      void requestPresentationFullscreen(el).catch(() => undefined);
    });
  }, [fsFitDraft]);

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
  }, [loop, safeIdx, sortedPages, videoDurationByElementId, manualNavEpoch]);

  const pageTitle =
    page != null
      ? slideDisplayLabel(typeof page.name === "string" ? page.name : "", safeIdx)
      : "";

  const goPrevSlide = useCallback(() => {
    setManualNavEpoch((n) => n + 1);
    setSlideIndex((i) => {
      const clamped = Math.min(i, sortedPages.length - 1);
      if (clamped > 0) return clamped - 1;
      return loop ? sortedPages.length - 1 : clamped;
    });
  }, [loop, sortedPages.length]);

  const goNextSlide = useCallback(() => {
    setManualNavEpoch((n) => n + 1);
    setSlideIndex((i) => {
      const clamped = Math.min(i, sortedPages.length - 1);
      if (clamped + 1 < sortedPages.length) return clamped + 1;
      return loop ? 0 : clamped;
    });
  }, [loop, sortedPages.length]);

  const prevDisabled = !loop && safeIdx <= 0;
  const nextDisabled = !loop && safeIdx >= maxIdx;

  useEffect(() => {
    if (sortedPages.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (t.closest("input, textarea, select, [contenteditable='true']")) return;
      }
      if (e.key === "ArrowLeft") {
        if (prevDisabled) return;
        e.preventDefault();
        goPrevSlide();
        return;
      }
      if (nextDisabled) return;
      e.preventDefault();
      goNextSlide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    goNextSlide,
    goPrevSlide,
    nextDisabled,
    prevDisabled,
    sortedPages.length,
  ]);

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

  const slideStage =
    page != null ? (
      <div
        className={cn(
          "flex items-center justify-center",
          /* fill은 transform 스케일 후 레이아웃 박스가 max-*에 막히면 가장자리 여백이 생길 수 있음 */
          isBrowserFullscreen && fsFitMode === "fill"
            ? "min-h-0 min-w-0"
            : "max-h-full max-w-full",
          runSlideEnterAnimation &&
            `book-pres-enter book-pres-enter--${incomingTransition}`,
        )}
        style={
          runSlideEnterAnimation
            ? { animationDuration: `${transitionMs}ms` }
            : undefined
        }
      >
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
      </div>
    ) : null;

  const fillStretch =
    isBrowserFullscreen &&
    fsFitMode === "fill" &&
    page != null &&
    layoutAvail.w > 0 &&
    layoutAvail.h > 0
      ? (() => {
          const cw = slideW * displayScale;
          const ch = slideH * displayScale;
          return {
            sx: cw > 0 ? layoutAvail.w / cw : 1,
            sy: ch > 0 ? layoutAvail.h / ch : 1,
          };
        })()
      : null;

  const shell = (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-zinc-950 text-zinc-100">
      <header className="pointer-events-auto relative z-10 grid h-9 min-h-9 min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1.5 border-b border-zinc-800 bg-zinc-950 px-1.5 sm:gap-x-2 sm:px-2">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden justify-self-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50"
            asChild
          >
            <Link to={`/books/${bookId}`} aria-label="북으로 돌아가기" title="돌아가기">
              <ArrowLeft className="size-3.5" />
            </Link>
          </Button>
          <div className="min-w-0 truncate leading-tight pointer-events-none">
            <span className="text-[11px] font-semibold text-zinc-100">{pageTitle}</span>
            <span className="mx-0.5 text-zinc-600" aria-hidden>
              ·
            </span>
            <span className="text-[9px] text-zinc-500">{data.title}</span>
          </div>
        </div>
        <nav
          className="pointer-events-auto relative z-20 flex shrink-0 items-center gap-0.5 sm:gap-1"
          aria-label="슬라이드 조작"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 shrink-0 touch-manipulation p-0 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50",
              prevDisabled && "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-zinc-200",
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (prevDisabled) return;
              goPrevSlide();
            }}
            aria-disabled={prevDisabled}
            aria-label="이전 슬라이드"
            title={prevDisabled ? "첫 슬라이드입니다 (반복 재생 시 마지막으로 이동)" : "이전 슬라이드"}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <div className="flex min-w-0 max-w-[min(52vw,16rem)] items-center gap-1 rounded-md border border-zinc-700/80 bg-zinc-900/70 px-1 py-px sm:max-w-[min(56vw,20rem)] sm:gap-1.5 sm:px-1.5">
            <div
              className="hidden h-0.5 min-h-0.5 w-[min(16vw,5rem)] overflow-hidden rounded-full bg-zinc-800 sm:block"
              role="progressbar"
              aria-valuenow={Math.round(progressPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="이 슬라이드 진행"
            >
              <div
                className="h-full rounded-full bg-emerald-500/90 transition-[width] duration-100 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span
              className="hidden shrink-0 tabular-nums text-[8px] text-zinc-500 md:inline"
              title="남은 시간 · 슬라이드 길이"
            >
              {remainingSec}s/{slideDurationSec}s
            </span>
            <span className="shrink-0 tabular-nums text-[9px] text-zinc-400">
              {safeIdx + 1}/{sortedPages.length}
            </span>
            <span className="hidden shrink-0 text-[8px] text-zinc-600 lg:inline">
              {loop ? "반복" : "1회"}
            </span>
            <div
              className="flex shrink-0 items-center gap-px rounded border border-zinc-700/60 bg-zinc-950/50 p-px"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                className="h-5 w-5 shrink-0 p-0 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  zoomOut();
                }}
                aria-label="축소"
              >
                −
              </Button>
              <span className="min-w-7 text-center text-[8px] tabular-nums text-zinc-400">
                {zoomPercent}%
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-5 w-5 shrink-0 p-0 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  zoomIn();
                }}
                aria-label="확대"
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-5 px-1 text-[8px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  zoomReset();
                }}
              >
                맞춤
              </Button>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 touch-manipulation p-0 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setFsDialogOpen(true);
            }}
            aria-label="전체 화면"
            title="전체 화면(맞춤 방식 선택)"
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 shrink-0 touch-manipulation p-0 text-zinc-200 hover:bg-zinc-800 hover:text-zinc-50",
              nextDisabled && "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-zinc-200",
            )}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (nextDisabled) return;
              goNextSlide();
            }}
            aria-disabled={nextDisabled}
            aria-label="다음 슬라이드"
            title={nextDisabled ? "마지막 슬라이드입니다 (반복 재생 시 처음으로 이동)" : "다음 슬라이드"}
          >
            <ChevronRight className="size-5" />
          </Button>
        </nav>
        <div className="min-w-0 justify-self-end" aria-hidden />
      </header>
      <div
        ref={presentationFsTargetRef}
        className="dark relative z-0 box-border flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-950"
      >
        <div
          ref={canvasWrapRef}
          className={bookCanvasStageMatClass(
            cn(
              "relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden",
              isBrowserFullscreen
                ? "p-0"
                : "px-4 py-5 sm:px-5 sm:py-6",
            ),
          )}
          onWheel={handleWheel}
        >
          {slideStage != null ? (
            isBrowserFullscreen && fsFitMode === "cover" ? (
              <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
                {slideStage}
              </div>
            ) : isBrowserFullscreen && fsFitMode === "fill" && fillStretch != null ? (
              <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
                <div
                  style={{
                    transform: `scale(${fillStretch.sx}, ${fillStretch.sy})`,
                    transformOrigin: "center center",
                  }}
                >
                  {slideStage}
                </div>
              </div>
            ) : (
              slideStage
            )
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {shell}
      <Dialog
        open={fsDialogOpen}
        onOpenChange={(open) => {
          setFsDialogOpen(open);
          if (open) setFsFitDraft(fsFitMode);
        }}
      >
        <DialogContent
          overlayClassName="z-[10001]"
          className="z-[10002] sm:max-w-md"
          showCloseButton
        >
          <DialogHeader>
            <DialogTitle>슬라이드 전체 화면</DialogTitle>
            <DialogDescription>
              화면에 맞추는 방식을 고른 뒤 시작합니다. 나가려면 Esc 키를 누르세요.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={fsFitDraft}
            onValueChange={(v) =>
              setFsFitDraft(v as BookCanvasDisplayFitMode)
            }
            className="grid gap-3"
          >
            <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3">
              <RadioGroupItem value="contain" id="pres-fs-contain" className="mt-0.5" />
              <div className="grid gap-0.5">
                <Label htmlFor="pres-fs-contain" className="cursor-pointer font-medium">
                  맞춤(contain)
                </Label>
                <p className="text-xs text-muted-foreground">
                  슬라이드 전체가 보이도록 맞춥니다. 화면 비율에 따라 여백이 생길 수 있습니다.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3">
              <RadioGroupItem value="cover" id="pres-fs-cover" className="mt-0.5" />
              <div className="grid gap-0.5">
                <Label htmlFor="pres-fs-cover" className="cursor-pointer font-medium">
                  덮기(cover)
                </Label>
                <p className="text-xs text-muted-foreground">
                  화면을 가득 채우도록 확대합니다. 비율이 다르면 가장자리가 잘릴 수 있습니다.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3">
              <RadioGroupItem value="fill" id="pres-fs-fill" className="mt-0.5" />
              <div className="grid gap-0.5">
                <Label htmlFor="pres-fs-fill" className="cursor-pointer font-medium">
                  꽉 채우기(fill)
                </Label>
                <p className="text-xs text-muted-foreground">
                  화면 비율에 맞게 늘려서 빈틈 없이 채웁니다. 가로·세로 비율이 달라지면 왜곡될 수 있습니다.
                </p>
              </div>
            </div>
          </RadioGroup>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFsDialogOpen(false)}
            >
              취소
            </Button>
            <Button type="button" onClick={confirmEnterFullscreen}>
              전체 화면 시작
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>,
    document.body,
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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteBook,
  fetchBook,
  updateBook,
  uploadBookMedia,
  type BookCanvasElement,
  type BookDetail,
  type BookPageDto,
} from "@/lib/api";
import {
  applyAutoSlideNamesByIndex,
  createEmptyEditorPage,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  duplicateBookEditorPage,
  pageIndexAfterRemove,
  pageIndexAfterReorder,
  reorderElementsZ,
  reorderPagesArray,
  toBookPagePayloads,
  type BookEditorPageState,
  type ElementZOrderOp,
} from "@/lib/book-canvas";
import { defaultTextWidgetBoxHeight } from "@/lib/book-text-widget";
import { warmBookCanvasImagesForNeighborPages } from "@/lib/book-image-cache";
import { bookKeys } from "@/lib/query-keys";
import { useBookCanvasDisplayScale } from "@/lib/use-book-canvas-display-scale";
import { useBookDocumentHistory } from "@/lib/use-book-document-history";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { useAuth } from "@/stores/auth-store";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import { BookHeaderSlideDimensions } from "@/components/books/BookHeaderSlideDimensions";
import { BookInspectorPanel } from "@/components/books/BookInspectorPanel";
import { BookPagePropertiesPanel } from "@/components/books/BookPagePropertiesPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import {
  BookSlideCanvas,
  type BookDropWidgetKind,
} from "@/components/books/BookSlideCanvas";
import { BookWidgetPalette } from "@/components/books/BookWidgetPalette";
import { BookWorkspaceShell } from "@/components/books/BookWorkspaceShell";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FormErrorAlert } from "@/components/forms/FormErrorAlert";

function mapServerPagesToLocal(pages: BookPageDto[]): BookEditorPageState[] {
  const sorted = [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
  return applyAutoSlideNamesByIndex(
    sorted.map((p, i) => ({
      clientKey: `srv-${p.id}`,
      sortOrder: i,
      name: typeof p.name === "string" ? p.name : "",
      backgroundColor:
        typeof p.backgroundColor === "string" && p.backgroundColor.trim()
          ? p.backgroundColor.trim()
          : DEFAULT_PAGE_BACKGROUND,
      elements: p.elements,
    })),
  );
}

/**
 * 북 진입 시 곧바로 편집 UI(위젯·저장). 서버 스냅샷이 바뀌면 `key`로 마운트 초기화.
 */
function BookDetailOwnerView({ bookId, serverBook }: { bookId: number; serverBook: BookDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bookTitle, setBookTitle] = useState(serverBook.title);
  const [pageIndex, setPageIndex] = useState(0);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    pages: localPages,
    updatePages,
    commitPages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBookDocumentHistory(mapServerPagesToLocal(serverBook.pages));
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pendingMediaKindRef = useRef<"image" | "video" | null>(null);
  const pendingPlacementRef = useRef<{ x: number; y: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slideWidth, setSlideWidth] = useState(
    () => serverBook.slideWidth ?? DEFAULT_SLIDE_WIDTH,
  );
  const [slideHeight, setSlideHeight] = useState(
    () => serverBook.slideHeight ?? DEFAULT_SLIDE_HEIGHT,
  );

  const maxPageIdx = Math.max(0, localPages.length - 1);
  const activePageIndex = Math.min(pageIndex, maxPageIdx);
  const activePage = localPages[activePageIndex];
  const canvasSelectedId =
    selectedId && activePage?.elements.some((e) => e.id === selectedId)
      ? selectedId
      : null;

  const {
    displayScale,
    zoomPercent,
    zoomIn,
    zoomOut,
    zoomReset,
    handleWheel,
  } = useBookCanvasDisplayScale(canvasWrapRef, {
    slideWidth,
    slideHeight,
    bottomPad: 120,
  });

  useEffect(() => {
    warmBookCanvasImagesForNeighborPages(localPages, activePageIndex);
  }, [localPages, activePageIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable=true]")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUndo, canRedo, undo, redo]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateBook(bookId, {
        title: bookTitle.trim() || "제목 없음",
        slideWidth,
        slideHeight,
        pages: toBookPagePayloads(localPages),
      }),
    onSuccess: (res) => {
      void queryClient.setQueryData(bookKeys.detail(bookId), res);
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      toast.success("저장했습니다.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteBook(bookId),
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      void queryClient.removeQueries({ queryKey: bookKeys.detail(bookId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      toast.success("북을 삭제했습니다.");
      void navigate("/books", { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBookDialog = (
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>북을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            “{bookTitle.trim() || "제목 없음"}” 북과 포함된 모든 페이지가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={deleteMutation.isPending}>
            취소
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? <Spinner className="mr-2 size-4" /> : null}
            삭제
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const onElementChange = useCallback(
    (elId: string, patch: Partial<BookCanvasElement>) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        const el = p.elements.find((x) => x.id === elId);
        if (!el) return;
        Object.assign(el, patch);
      });
    },
    [activePageIndex, updatePages],
  );

  const onReorderZ = useCallback(
    (elementId: string, op: ElementZOrderOp) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = reorderElementsZ(p.elements, elementId, op);
      });
    },
    [activePageIndex, updatePages],
  );

  const updateCurrentPageName = useCallback(
    (name: string) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.name = name;
      });
    },
    [activePageIndex, updatePages],
  );

  const updateCurrentPageBackground = useCallback(
    (backgroundColor: string) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.backgroundColor = backgroundColor;
      });
    },
    [activePageIndex, updatePages],
  );

  const addTextAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "text",
        x,
        y,
        text: "텍스트를 입력하세요",
        richHtml: "<p>텍스트를 입력하세요</p>",
        fontSize: 28,
        fill: "#111827",
        width: 480,
        height: defaultTextWidgetBoxHeight(28),
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedId(id);
    },
    [activePageIndex, updatePages],
  );

  const handleMediaFile = async (file: File, kind: "image" | "video") => {
    setUploadError(null);
    const pos = pendingPlacementRef.current ?? { x: 100, y: 100 };
    const idx = activePageIndex;
    pendingPlacementRef.current = null;
    pendingMediaKindRef.current = null;
    try {
      const res = await uploadBookMedia(bookId, file, null);
      if (kind === "image" && res.kind !== "image") {
        throw new Error("이미지 파일이 아닙니다.");
      }
      if (kind === "video" && res.kind !== "video") {
        throw new Error("동영상 파일이 아닙니다.");
      }
      const id = crypto.randomUUID();
      const w = kind === "image" ? 400 : 480;
      const h = kind === "image" ? 260 : 270;
      const el: BookCanvasElement =
        res.kind === "image"
          ? {
              id,
              type: "image",
              x: pos.x,
              y: pos.y,
              width: w,
              height: h,
              src: res.url,
            }
          : {
              id,
              type: "video",
              x: pos.x,
              y: pos.y,
              width: w,
              height: h,
              src: res.url,
              posterSrc: res.posterUrl,
            };
      updatePages((draft) => {
        const p = draft[idx];
        if (p) p.elements.push(el);
      });
      setSelectedId(id);
      toast.success(kind === "image" ? "이미지를 넣었습니다." : "동영상을 넣었습니다.");
    } catch (e) {
      setUploadError((e as Error).message);
    }
  };

  const onDropWidget = useCallback(
    (point: { x: number; y: number }, kind: BookDropWidgetKind) => {
      if (kind === "text") {
        addTextAt(point.x, point.y);
        return;
      }
      pendingPlacementRef.current = point;
      pendingMediaKindRef.current = kind;
      if (kind === "image") {
        imageInputRef.current?.click();
      } else {
        videoInputRef.current?.click();
      }
    },
    [addTextAt],
  );

  const addPage = useCallback(() => {
    commitPages((prev) =>
      applyAutoSlideNamesByIndex([...prev, createEmptyEditorPage(prev.length)]),
    );
    setPageIndex(localPages.length);
    setSelectedId(null);
  }, [commitPages, localPages.length]);

  const removePageAt = useCallback(
    (index: number) => {
      let nextIdx = activePageIndex;
      commitPages((prev) => {
        if (prev.length <= 1 || index < 0 || index >= prev.length) return prev;
        const next = prev.filter((_, i) => i !== index);
        nextIdx = pageIndexAfterRemove(activePageIndex, index, prev.length);
        return applyAutoSlideNamesByIndex(next);
      });
      setPageIndex(nextIdx);
      setSelectedId(null);
    },
    [activePageIndex, commitPages],
  );

  const duplicatePageAt = useCallback(
    (index: number) => {
      commitPages((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const dup = duplicateBookEditorPage(prev[index]);
        const next = [...prev.slice(0, index + 1), dup, ...prev.slice(index + 1)];
        return applyAutoSlideNamesByIndex(next.map((p, i) => ({ ...p, sortOrder: i })));
      });
      setPageIndex(index + 1);
      setSelectedId(null);
    },
    [commitPages],
  );

  const removeElementById = useCallback(
    (elementId: string) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = p.elements.filter((e) => e.id !== elementId);
      });
      setSelectedId((cur) => (cur === elementId ? null : cur));
    },
    [activePageIndex, updatePages],
  );

  const removeSelected = useCallback(() => {
    if (!canvasSelectedId) return;
    removeElementById(canvasSelectedId);
  }, [canvasSelectedId, removeElementById]);

  const reorderPages = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const maxIdx = Math.max(0, localPages.length - 1);
      commitPages((prev) => reorderPagesArray(prev, from, to));
      setPageIndex((cur) => {
        const c = Math.min(cur, maxIdx);
        const next = pageIndexAfterReorder(c, from, to);
        return Math.min(next, maxIdx);
      });
    },
    [commitPages, localPages.length],
  );

  const selectedEl = useMemo(() => {
    if (!canvasSelectedId || !activePage) return null;
    return activePage.elements.find((e) => e.id === canvasSelectedId) ?? null;
  }, [canvasSelectedId, activePage]);

  const mediaHint = useMemo(() => uploadError, [uploadError]);

  const pageLabels = useMemo(() => localPages.map((p) => p.name), [localPages]);
  const pageKeys = useMemo(() => localPages.map((p) => p.clientKey), [localPages]);

  const slideThumbnailSources = useMemo(
    () =>
      localPages.map((p) => ({
        clientKey: p.clientKey,
        backgroundColor: p.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND,
        elements: p.elements,
      })),
    [localPages],
  );
  const slideThumbnails = useBookPageThumbnails(
    slideThumbnailSources,
    slideWidth,
    slideHeight,
  );

  if (localPages.length === 0) {
    return (
      <BookWorkspaceShell
        titleArea={
          <div className="flex min-w-0 flex-wrap items-center gap-y-2">
            <Input
              className="h-9 min-w-[10rem] max-w-md flex-1 border-transparent bg-transparent pl-3 pr-2 text-base font-semibold shadow-none focus-visible:ring-0 sm:text-lg"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              placeholder="북 제목"
              maxLength={200}
              aria-label="북 제목"
            />
            <BookHeaderSlideDimensions
              slideWidth={slideWidth}
              slideHeight={slideHeight}
              onChangeSlideWidth={setSlideWidth}
              onChangeSlideHeight={setSlideHeight}
            />
          </div>
        }
        actions={
          <>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                className="border-transparent bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500/40"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || localPages.length === 0}
              >
                {saveMutation.isPending ? (
                  <Spinner className="mr-2 size-4 text-white" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                저장
              </Button>
              <Button
                type="button"
                size="sm"
                className="border-transparent bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="mr-2 size-4" />
                삭제
              </Button>
            </div>
            {deleteBookDialog}
          </>
        }
        left={
          <BookPageSidebar
            pageCount={0}
            activeIndex={0}
            onSelectPage={() => undefined}
            mode="edit"
            onAddPage={addPage}
            canRemovePage={false}
          />
        }
        center={
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">페이지가 없습니다. 왼쪽에서 페이지를 추가하세요.</p>
            <Button type="button" onClick={addPage}>
              첫 페이지 추가
            </Button>
          </div>
        }
        right={
          <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card/50 p-3">
            <p className="text-sm text-muted-foreground">
              페이지를 추가한 뒤 여기서 슬라이드 이름을 바꿀 수 있습니다. 크기는 헤더 캔버스 W·H를 사용하세요.
            </p>
          </aside>
        }
      />
    );
  }

  return (
    <BookWorkspaceShell
      titleArea={
        <div className="flex min-w-0 flex-wrap items-center gap-y-2">
          <Input
            className="h-9 min-w-[10rem] max-w-md flex-1 border-transparent bg-transparent pl-3 pr-2 text-base font-semibold shadow-none focus-visible:ring-0 sm:text-lg"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="북 제목"
            maxLength={200}
            aria-label="북 제목"
          />
          <BookHeaderSlideDimensions
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            onChangeSlideWidth={setSlideWidth}
            onChangeSlideHeight={setSlideHeight}
          />
        </div>
      }
      actions={
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              className="border-transparent bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500/40"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Spinner className="mr-2 size-4 text-white" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              저장
            </Button>
            <Button
              type="button"
              size="sm"
              className="border-transparent bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteConfirmOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              삭제
            </Button>
          </div>
          {deleteBookDialog}
        </>
      }
      left={
        <BookPageSidebar
          pageCount={localPages.length}
          pageKeys={pageKeys}
          thumbnailsByKey={slideThumbnails}
          activeIndex={activePageIndex}
          pageLabels={pageLabels}
          onSelectPage={(i) => {
            setPageIndex(i);
            setSelectedId(null);
          }}
          mode="edit"
          onReorderPages={reorderPages}
          onAddPage={addPage}
          onRemovePageAtIndex={removePageAt}
          onDuplicatePageAtIndex={duplicatePageAt}
          canRemovePage={localPages.length > 1}
        />
      }
      center={
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 justify-center border-b border-border/60 bg-muted/15 px-2 py-2">
              <BookCanvasToolbar
                zoomPercent={zoomPercent}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onZoomReset={zoomReset}
                showUndoRedo
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
              />
            </div>
            <div
              ref={canvasWrapRef}
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 pb-24"
              onWheel={handleWheel}
              onPointerDown={(e) => {
                const slide = (e.currentTarget as HTMLElement).querySelector("[data-book-slide-root]");
                if (slide?.contains(e.target as Node)) return;
                setSelectedId(null);
              }}
            >
              <BookSlideCanvas
                pageWidth={slideWidth}
                pageHeight={slideHeight}
                pageBackgroundColor={
                  activePage.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND
                }
                scale={displayScale}
                elements={activePage.elements}
                mode="edit"
                selectedId={canvasSelectedId}
                onSelect={setSelectedId}
                onElementChange={onElementChange}
                onDropWidget={onDropWidget}
                onReorderZ={onReorderZ}
                onDeleteElement={removeElementById}
              />
            </div>
          </div>
          <BookWidgetPalette />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && pendingMediaKindRef.current === "image") {
                void handleMediaFile(f, "image");
              }
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && pendingMediaKindRef.current === "video") {
                void handleMediaFile(f, "video");
              }
            }}
          />
        </>
      }
      right={
        canvasSelectedId ? (
          <BookInspectorPanel
            selected={selectedEl}
            slideWidth={slideWidth}
            slideHeight={slideHeight}
            onChange={onElementChange}
            onDelete={removeSelected}
            mediaHint={mediaHint}
          />
        ) : (
          <BookPagePropertiesPanel
            pageIndex={activePageIndex}
            totalPages={localPages.length}
            name={activePage.name}
            onChangeName={updateCurrentPageName}
            backgroundColor={
              activePage.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND
            }
            onChangeBackgroundColor={updateCurrentPageBackground}
          />
        )
      }
    />
  );
}

function BookDetailGuestBookView({
  data,
  sortedPagesView,
  pageIndex,
  setPageIndex,
}: {
  data: BookDetail;
  sortedPagesView: NonNullable<BookDetail["pages"]>;
  pageIndex: number;
  setPageIndex: Dispatch<SetStateAction<number>>;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const guestSlideW = data.slideWidth ?? DEFAULT_SLIDE_WIDTH;
  const guestSlideH = data.slideHeight ?? DEFAULT_SLIDE_HEIGHT;
  const guestPageLabels = useMemo(
    () => sortedPagesView.map((p) => p.name ?? ""),
    [sortedPagesView],
  );

  const guestThumbSources = useMemo(
    () =>
      sortedPagesView.map((p) => ({
        clientKey: `v-${p.id}`,
        backgroundColor:
          typeof p.backgroundColor === "string" && p.backgroundColor.trim()
            ? p.backgroundColor.trim()
            : DEFAULT_PAGE_BACKGROUND,
        elements: p.elements,
      })),
    [sortedPagesView],
  );
  const guestThumbnails = useBookPageThumbnails(
    guestThumbSources,
    guestSlideW,
    guestSlideH,
  );

  const guestCanvasScale = useBookCanvasDisplayScale(canvasWrapRef, {
    slideWidth: guestSlideW,
    slideHeight: guestSlideH,
    bottomPad: 48,
  });

  const safeIndex = Math.min(pageIndex, Math.max(0, sortedPagesView.length - 1));
  const viewPage = sortedPagesView[safeIndex];

  useEffect(() => {
    warmBookCanvasImagesForNeighborPages(guestThumbSources, safeIndex);
  }, [guestThumbSources, safeIndex]);

  return (
    <BookWorkspaceShell
      titleArea={
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight sm:text-lg">{data.title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {data.author.name} · {sortedPagesView.length}페이지 · {safeIndex + 1}번째 보는 중
          </p>
        </div>
      }
      left={
        <BookPageSidebar
          pageCount={sortedPagesView.length}
          pageKeys={sortedPagesView.map((p) => `v-${p.id}`)}
          thumbnailsByKey={guestThumbnails}
          activeIndex={safeIndex}
          pageLabels={guestPageLabels}
          onSelectPage={setPageIndex}
          mode="view"
        />
      }
      center={
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 justify-center border-b border-border/60 bg-muted/15 px-2 py-2">
            <BookCanvasToolbar
              zoomPercent={guestCanvasScale.zoomPercent}
              onZoomIn={guestCanvasScale.zoomIn}
              onZoomOut={guestCanvasScale.zoomOut}
              onZoomReset={guestCanvasScale.zoomReset}
            />
          </div>
          <div
            ref={canvasWrapRef}
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
            onWheel={guestCanvasScale.handleWheel}
          >
            <BookSlideCanvas
              pageWidth={guestSlideW}
              pageHeight={guestSlideH}
              pageBackgroundColor={
                typeof viewPage.backgroundColor === "string" &&
                viewPage.backgroundColor.trim()
                  ? viewPage.backgroundColor.trim()
                  : DEFAULT_PAGE_BACKGROUND
              }
              scale={guestCanvasScale.displayScale}
              elements={viewPage.elements}
              mode="view"
              selectedId={null}
              onSelect={() => undefined}
              onElementChange={() => undefined}
            />
          </div>
        </div>
      }
    />
  );
}

export function BookDetailPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { user } = useAuth();
  const [pageIndex, setPageIndex] = useState(0);

  const { data, error, isPending } = useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => fetchBook(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const canEdit = Boolean(user && data && user.sub === data.author.id);

  const sortedPagesView = useMemo(() => {
    if (!data?.pages) return [];
    return [...data.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <BookWorkspaceShell
        titleArea={<span className="text-sm text-muted-foreground">잘못된 주소</span>}
        left={<div className="w-52 shrink-0 border-r border-border bg-card/50" />}
        center={
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
            <p className="text-sm text-muted-foreground">목록에서 북을 다시 선택해 주세요.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/books">목록</Link>
            </Button>
          </div>
        }
      />
    );
  }

  if (isPending) {
    return (
      <BookWorkspaceShell
        titleArea={<span className="truncate text-sm text-muted-foreground">불러오는 중…</span>}
        left={<div className="w-52 shrink-0 border-r border-border bg-card/50" />}
        center={
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="size-10 text-muted-foreground" />
          </div>
        }
      />
    );
  }

  if (error || !data) {
    return (
      <BookWorkspaceShell
        titleArea={<span className="text-destructive">오류</span>}
        left={<div className="w-52 shrink-0 border-r border-border" />}
        center={
          <div className="flex flex-1 items-center justify-center p-4">
            <FormErrorAlert message={(error as Error)?.message ?? "불러오지 못했습니다."} />
          </div>
        }
      />
    );
  }

  if (canEdit) {
    return <BookDetailOwnerView key={`${data.id}-${data.updatedAt}`} bookId={id} serverBook={data} />;
  }

  if (!sortedPagesView.length) {
    return (
      <BookWorkspaceShell
        titleArea={<h1 className="truncate text-base font-semibold sm:text-lg">{data.title}</h1>}
        left={<div className="w-52 shrink-0 border-r border-border bg-card/50" />}
        center={
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">이 북에는 페이지가 없습니다.</p>
          </div>
        }
      />
    );
  }

  return (
    <BookDetailGuestBookView
      data={data}
      sortedPagesView={sortedPagesView}
      pageIndex={pageIndex}
      setPageIndex={setPageIndex}
    />
  );
}

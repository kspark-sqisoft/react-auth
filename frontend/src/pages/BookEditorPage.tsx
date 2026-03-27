import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { createBook, type BookCanvasElement } from "@/lib/api";
import {
  applyAutoSlideNamesByIndex,
  createEmptyEditorPage,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  pageIndexAfterRemove,
  pageIndexAfterReorder,
  reorderElementsZ,
  reorderPagesArray,
  toBookPagePayloads,
  type ElementZOrderOp,
} from "@/lib/book-canvas";
import { defaultTextWidgetBoxHeight } from "@/lib/book-text-widget";
import { bookKeys } from "@/lib/query-keys";
import { useBookCanvasDisplayScale } from "@/lib/use-book-canvas-display-scale";
import { useBookDocumentHistory } from "@/lib/use-book-document-history";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import { BookInspectorPanel } from "@/components/books/BookInspectorPanel";
import { BookHeaderSlideDimensions } from "@/components/books/BookHeaderSlideDimensions";
import { BookPagePropertiesPanel } from "@/components/books/BookPagePropertiesPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import {
  BookSlideCanvas,
  type BookDropWidgetKind,
} from "@/components/books/BookSlideCanvas";
import { BookWidgetPalette } from "@/components/books/BookWidgetPalette";
import { BookWorkspaceShell } from "@/components/books/BookWorkspaceShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** `/books/new` — 저장 후 `/books/:id`로 이동해 동일 편집 UI를 씁니다. */
export function BookEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const {
    pages,
    updatePages,
    commitPages,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBookDocumentHistory(applyAutoSlideNamesByIndex([createEmptyEditorPage(0)]));
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [slideWidth, setSlideWidth] = useState(DEFAULT_SLIDE_WIDTH);
  const [slideHeight, setSlideHeight] = useState(DEFAULT_SLIDE_HEIGHT);

  const maxPageIdx = Math.max(0, pages.length - 1);
  const activePageIndex = Math.min(pageIndex, maxPageIdx);
  const currentPage = pages[activePageIndex] ?? pages[0];
  const canvasSelectedId =
    selectedId && currentPage?.elements.some((e) => e.id === selectedId)
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
      createBook({
        title: title.trim() || "제목 없음",
        slideWidth,
        slideHeight,
        pages: toBookPagePayloads(pages),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.lists() });
      void queryClient.setQueryData(bookKeys.detail(res.id), res);
      toast.success("북을 만들었습니다.");
      void navigate(`/books/${res.id}`, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const onDropWidget = useCallback(
    (point: { x: number; y: number }, kind: BookDropWidgetKind) => {
      if (kind === "text") {
        addTextAt(point.x, point.y);
        return;
      }
      toast.error("저장한 뒤 열린 북 화면에서 이미지·동영상 위젯을 넣을 수 있습니다.");
    },
    [addTextAt],
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

  const removeSelected = () => {
    if (!canvasSelectedId) return;
    removeElementById(canvasSelectedId);
  };

  const addPage = () => {
    commitPages((prev) =>
      applyAutoSlideNamesByIndex([...prev, createEmptyEditorPage(prev.length)]),
    );
    setPageIndex(pages.length);
    setSelectedId(null);
  };

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

  const reorderPages = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const maxIdx = Math.max(0, pages.length - 1);
      commitPages((prev) => reorderPagesArray(prev, from, to));
      setPageIndex((cur) => {
        const c = Math.min(cur, maxIdx);
        const next = pageIndexAfterReorder(c, from, to);
        return Math.min(next, maxIdx);
      });
    },
    [commitPages, pages.length],
  );

  const selectedEl = useMemo(() => {
    if (!canvasSelectedId || !currentPage) return null;
    return currentPage.elements.find((e) => e.id === canvasSelectedId) ?? null;
  }, [canvasSelectedId, currentPage]);

  const mediaHint = useMemo(
    () => "저장하면 북이 만들어지고, 그 화면에서 이미지·동영상 위젯을 쓸 수 있습니다.",
    [],
  );

  const pageLabels = useMemo(() => pages.map((p) => p.name), [pages]);
  const pageKeys = useMemo(() => pages.map((p) => p.clientKey), [pages]);

  const slideThumbnailSources = useMemo(
    () =>
      pages.map((p) => ({
        clientKey: p.clientKey,
        backgroundColor: p.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND,
        elements: p.elements,
      })),
    [pages],
  );
  const slideThumbnails = useBookPageThumbnails(
    slideThumbnailSources,
    slideWidth,
    slideHeight,
  );

  return (
    <BookWorkspaceShell
      titleArea={
        <div className="flex min-w-0 flex-wrap items-center gap-y-2">
          <Input
            className="h-9 min-w-[10rem] max-w-md flex-1 border-transparent bg-transparent px-0 text-base font-semibold shadow-none focus-visible:ring-0 sm:text-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
        <Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Spinner className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
          저장
        </Button>
      }
      left={
        <BookPageSidebar
          pageCount={pages.length}
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
          canRemovePage={pages.length > 1}
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
            >
              {currentPage ? (
                <BookSlideCanvas
                  pageWidth={slideWidth}
                  pageHeight={slideHeight}
                  pageBackgroundColor={
                    currentPage.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND
                  }
                  scale={displayScale}
                  elements={currentPage.elements}
                  mode="edit"
                  selectedId={canvasSelectedId}
                  onSelect={setSelectedId}
                  onElementChange={onElementChange}
                  onDropWidget={onDropWidget}
                  onReorderZ={onReorderZ}
                  onDeleteElement={removeElementById}
                />
              ) : null}
            </div>
          </div>
          <BookWidgetPalette />
        </>
      }
      right={
        canvasSelectedId ? (
          <BookInspectorPanel
            selected={selectedEl}
            onChange={onElementChange}
            onDelete={removeSelected}
            mediaHint={mediaHint}
          />
        ) : currentPage ? (
          <BookPagePropertiesPanel
            pageIndex={activePageIndex}
            totalPages={pages.length}
            name={currentPage.name}
            onChangeName={updateCurrentPageName}
            backgroundColor={
              currentPage.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND
            }
            onChangeBackgroundColor={updateCurrentPageBackground}
          />
        ) : null
      }
    />
  );
}

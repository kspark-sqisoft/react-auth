import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { createBook, type BookCanvasElement } from "@/lib/api";
import {
  applyAutoSlideNamesByIndex,
  BOOK_CANVAS_DRAG_GRID_PX,
  createEmptyEditorPage,
  DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
  DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
  DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
  DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_SLIDE_HEIGHT,
  DEFAULT_SLIDE_WIDTH,
  duplicateBookEditorPage,
  pageIndexAfterRemove,
  pageIndexAfterReorder,
  reorderBookElementsByDisplayIndex,
  reorderElementsZ,
  reorderPagesArray,
  toBookPagePayloads,
  type ElementZOrderOp,
} from "@/lib/book-canvas";
import { defaultTextWidgetBoxHeight } from "@/lib/book-text-widget";
import { warmBookCanvasImagesForNeighborPages } from "@/lib/book-image-cache";
import type { BookEditorLeftTab } from "@/lib/book-editor-panel-events";
import {
  instantiateBookSlideTemplate,
  type BookSlideTemplateId,
} from "@/lib/book-slide-templates";
import {
  readFloatingWidgetPaletteVisible,
  writeFloatingWidgetPaletteVisible,
} from "@/lib/book-floating-ui-prefs";
import { bookLeftDockContentColumnClass } from "@/lib/book-workspace-ui";
import { bookKeys } from "@/lib/query-keys";
import { useBookCanvasDisplayScale } from "@/lib/use-book-canvas-display-scale";
import { useBookDocumentHistory } from "@/lib/use-book-document-history";
import { useBookPageThumbnails } from "@/lib/use-book-page-thumbnails";
import { BookCanvasToolbar } from "@/components/books/BookCanvasToolbar";
import { BookInspectorPanel } from "@/components/books/BookInspectorPanel";
import { BookLayersPanel } from "@/components/books/BookLayersPanel";
import { BookHeaderSlideDimensions } from "@/components/books/BookHeaderSlideDimensions";
import { BookPagePropertiesPanel } from "@/components/books/BookPagePropertiesPanel";
import { BookPageSidebar } from "@/components/books/BookPageSidebar";
import {
  BookSlideCanvas,
  DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
  type BookCanvasSelectDetail,
  type BookDropWidgetKind,
} from "@/components/books/BookSlideCanvas";
import { BookEditorToolRail } from "@/components/books/BookEditorToolRail";
import { BookSlideDrawingPanel } from "@/components/books/BookSlideDrawingPanel";
import { BookSlideTemplatesPanel } from "@/components/books/BookSlideTemplatesPanel";
import { BookAiAssistantPanel } from "@/components/books/BookAiAssistantPanel";
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [slideWidth, setSlideWidth] = useState(DEFAULT_SLIDE_WIDTH);
  const [slideHeight, setSlideHeight] = useState(DEFAULT_SLIDE_HEIGHT);
  const [widgetDeleteOpen, setWidgetDeleteOpen] = useState(false);
  const [widgetDeleteIds, setWidgetDeleteIds] = useState<string[]>([]);
  const [pageDeleteOpen, setPageDeleteOpen] = useState(false);
  const [pageDeleteIndex, setPageDeleteIndex] = useState<number | null>(null);
  const [centerGuideThresholdPx, setCenterGuideThresholdPx] = useState(
    DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
  );
  const [dragGridPx, setDragGridPx] = useState(BOOK_CANVAS_DRAG_GRID_PX);
  const [leftDockTab, setLeftDockTab] = useState<BookEditorLeftTab>("page");
  const [drawingStrokeColor, setDrawingStrokeColor] = useState("#0f172a");
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(4);
  const [floatingWidgetPaletteOpen, setFloatingWidgetPaletteOpen] = useState(
    readFloatingWidgetPaletteVisible,
  );
  const persistWidgetFloatingOpen = useCallback((open: boolean) => {
    writeFloatingWidgetPaletteVisible(open);
    setFloatingWidgetPaletteOpen(open);
  }, []);

  const maxPageIdx = Math.max(0, pages.length - 1);
  const activePageIndex = Math.min(pageIndex, maxPageIdx);
  const currentPage = pages[activePageIndex] ?? pages[0];
  const canvasSelectedIds = useMemo(() => {
    if (!currentPage) return [];
    const onPage = new Set(currentPage.elements.map((e) => e.id));
    return selectedIds.filter((id) => onPage.has(id));
  }, [selectedIds, currentPage]);

  const handleCanvasSelect = useCallback((d: BookCanvasSelectDetail) => {
    if (d.id === null) {
      setSelectedIds([]);
      return;
    }
    const nextId = d.id;
    setSelectedIds((prev) => {
      if (d.shiftKey) {
        const nex = new Set(prev);
        if (nex.has(nextId)) nex.delete(nextId);
        else nex.add(nextId);
        return Array.from(nex);
      }
      return [nextId];
    });
  }, []);

  const handleLayerSelect = useCallback((id: string, shiftKey?: boolean) => {
    setSelectedIds((prev) => {
      if (shiftKey) {
        const nex = new Set(prev);
        if (nex.has(id)) nex.delete(id);
        else nex.add(id);
        return Array.from(nex);
      }
      return [id];
    });
  }, []);

  useEffect(() => {
    if (!currentPage) return;
    const onPage = new Set(currentPage.elements.map((e) => e.id));
    queueMicrotask(() => {
      setSelectedIds((prev) => {
        const next = prev.filter((id) => onPage.has(id));
        if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
        return next;
      });
    });
  }, [currentPage]);

  useEffect(() => {
    warmBookCanvasImagesForNeighborPages(pages, activePageIndex);
  }, [pages, activePageIndex]);

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
      if (
        t.closest(
          '[data-slot="select-content"], [data-slot="combobox-content"], [data-slot="combobox-list"]',
        )
      ) {
        return;
      }
      if (widgetDeleteOpen || pageDeleteOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (!currentPage) return;
        setSelectedIds(currentPage.elements.map((el) => el.id));
        return;
      }
      if (e.key === "Escape" && canvasSelectedIds.length > 0) {
        e.preventDefault();
        setSelectedIds([]);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (canRedo) redo();
      } else if (
        e.key === "Delete" &&
        canvasSelectedIds.length === 0 &&
        pages.length > 1
      ) {
        e.preventDefault();
        setPageDeleteIndex(activePageIndex);
        setPageDeleteOpen(true);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        canvasSelectedIds.length > 0
      ) {
        e.preventDefault();
        setWidgetDeleteIds([...canvasSelectedIds]);
        setWidgetDeleteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    canvasSelectedIds,
    currentPage,
    widgetDeleteOpen,
    pageDeleteOpen,
    pages.length,
    activePageIndex,
  ]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable=true]")) return;
      if (
        t.closest(
          '[data-slot="select-content"], [data-slot="combobox-content"], [data-slot="combobox-list"]',
        )
      ) {
        return;
      }
      if (widgetDeleteOpen || pageDeleteOpen) return;
      e.preventDefault();
      if (saveMutation.isPending) return;
      saveMutation.mutate();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [saveMutation, widgetDeleteOpen, pageDeleteOpen]);

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

  const onLayerDragReorder = useCallback(
    (fromDisplay: number, toDisplay: number) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = reorderBookElementsByDisplayIndex(p.elements, fromDisplay, toDisplay);
      });
    },
    [activePageIndex, updatePages],
  );

  const onLayerVisibilityChange = useCallback(
    (elementId: string, visible: boolean) => {
      onElementChange(
        elementId,
        visible ? ({ visible: undefined } as Partial<BookCanvasElement>) : { visible: false },
      );
      if (!visible) {
        setSelectedIds((prev) => prev.filter((id) => id !== elementId));
      }
    },
    [onElementChange],
  );

  const onLayerLockChange = useCallback(
    (elementId: string, locked: boolean) => {
      onElementChange(
        elementId,
        locked ? { locked: true } : ({ locked: undefined } as Partial<BookCanvasElement>),
      );
    },
    [onElementChange],
  );

  const applySlideTemplate = useCallback(
    (templateId: BookSlideTemplateId) => {
      if (!currentPage) return;
      const nextElements = instantiateBookSlideTemplate(templateId, slideWidth, slideHeight);
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = nextElements;
      });
      setSelectedIds([]);
      toast.success("슬라이드 내용을 비우고 템플릿을 적용했습니다.");
    },
    [activePageIndex, currentPage, slideHeight, slideWidth, setSelectedIds, updatePages],
  );

  const onAppendDrawingElement = useCallback(
    (el: BookCanvasElement) => {
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements.push(el);
      });
      setSelectedIds([el.id]);
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

  const updatePageNameAt = useCallback(
    (index: number, name: string) => {
      updatePages((draft) => {
        const p = draft[index];
        if (p) p.name = name;
      });
    },
    [updatePages],
  );

  const applyPageTitleFromAi = useCallback(
    (name: string, opts?: { slideNumber?: number }) => {
      const n = opts?.slideNumber;
      if (n == null || !Number.isFinite(n)) {
        updatePageNameAt(activePageIndex, name);
        return;
      }
      if (pages.length === 0) return;
      const idx = Math.round(n) - 1;
      const clamped = Math.min(pages.length - 1, Math.max(0, idx));
      updatePageNameAt(clamped, name);
    },
    [activePageIndex, pages.length, updatePageNameAt],
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
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addWeatherAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "weather",
        x,
        y,
        width: DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
        height: DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const addDigitalClockAt = useCallback(
    (x: number, y: number) => {
      const id = crypto.randomUUID();
      const el: BookCanvasElement = {
        id,
        type: "digitalClock",
        x,
        y,
        width: DEFAULT_BOOK_DIGITAL_CLOCK_WIDTH,
        height: DEFAULT_BOOK_DIGITAL_CLOCK_HEIGHT,
      };
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (p) p.elements.push(el);
      });
      setSelectedIds([id]);
    },
    [activePageIndex, updatePages],
  );

  const onDropWidget = useCallback(
    (point: { x: number; y: number }, kind: BookDropWidgetKind) => {
      if (kind === "text") {
        addTextAt(point.x, point.y);
        return;
      }
      if (kind === "weather") {
        addWeatherAt(point.x, point.y);
        return;
      }
      if (kind === "digitalClock") {
        addDigitalClockAt(point.x, point.y);
        return;
      }
      toast.error("저장한 뒤 열린 북 화면에서 이미지·동영상 위젯을 넣을 수 있습니다.");
    },
    [addDigitalClockAt, addTextAt, addWeatherAt],
  );

  const applyAiElements = useCallback(
    (
      elements: BookCanvasElement[],
      opts?: { targetSlideNumber?: number },
    ) => {
      if (elements.length === 0) return;
      let navigatedIdx: number | null = null;
      updatePages((draft) => {
        const maxIdx = Math.max(0, draft.length - 1);
        const idx =
          typeof opts?.targetSlideNumber === "number" &&
          Number.isFinite(opts.targetSlideNumber)
            ? Math.min(maxIdx, Math.max(0, Math.round(opts.targetSlideNumber) - 1))
            : Math.min(Math.max(0, activePageIndex), maxIdx);
        const p = draft[idx];
        if (!p) return;
        for (const el of elements) p.elements.push(el);
        if (
          typeof opts?.targetSlideNumber === "number" &&
          Number.isFinite(opts.targetSlideNumber)
        ) {
          navigatedIdx = idx;
        }
      });
      if (navigatedIdx != null) {
        setPageIndex(navigatedIdx);
      }
      setSelectedIds([elements[elements.length - 1]!.id]);
    },
    [activePageIndex, updatePages],
  );

  const addPagesFromAi = useCallback(
    (count: number) => {
      const n = Math.min(20, Math.max(1, Math.round(count)));
      const prevLen = pages.length;
      commitPages((prev) => {
        const next = [...prev];
        for (let i = 0; i < n; i++) {
          next.push(createEmptyEditorPage(next.length));
        }
        return applyAutoSlideNamesByIndex(next);
      });
      setPageIndex(prevLen + n - 1);
      setSelectedIds([]);
    },
    [commitPages, pages.length],
  );

  const applySlideDimensionsFromAi = useCallback(
    (partial: { slideWidth?: number; slideHeight?: number }) => {
      if (typeof partial.slideWidth === "number") setSlideWidth(partial.slideWidth);
      if (typeof partial.slideHeight === "number") setSlideHeight(partial.slideHeight);
    },
    [],
  );

  const removeElementsByIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      updatePages((draft) => {
        const p = draft[activePageIndex];
        if (!p) return;
        p.elements = p.elements.filter((e) => !idSet.has(e.id));
      });
      setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
    },
    [activePageIndex, updatePages],
  );

  const requestRemoveWidget = useCallback((elementId: string) => {
    setWidgetDeleteIds([elementId]);
    setWidgetDeleteOpen(true);
  }, []);

  const confirmRemoveWidget = useCallback(() => {
    if (widgetDeleteIds.length > 0) removeElementsByIds(widgetDeleteIds);
    setWidgetDeleteOpen(false);
    setWidgetDeleteIds([]);
  }, [widgetDeleteIds, removeElementsByIds]);

  const removeSelected = useCallback(() => {
    if (canvasSelectedIds.length !== 1) return;
    requestRemoveWidget(canvasSelectedIds[0]!);
  }, [canvasSelectedIds, requestRemoveWidget]);

  const removeSelectedBulk = useCallback(() => {
    if (canvasSelectedIds.length === 0) return;
    setWidgetDeleteIds([...canvasSelectedIds]);
    setWidgetDeleteOpen(true);
  }, [canvasSelectedIds]);

  const addPage = () => {
    commitPages((prev) =>
      applyAutoSlideNamesByIndex([...prev, createEmptyEditorPage(prev.length)]),
    );
    setPageIndex(pages.length);
    setSelectedIds([]);
  };

  const addPageAtInsertIndex = useCallback(
    (insertIndex: number) => {
      commitPages((prev) => {
        const idx = Math.max(0, Math.min(insertIndex, prev.length));
        const newPage = createEmptyEditorPage(0);
        const next = [...prev.slice(0, idx), newPage, ...prev.slice(idx)];
        return applyAutoSlideNamesByIndex(next.map((p, i) => ({ ...p, sortOrder: i })));
      });
      setPageIndex(insertIndex);
      setSelectedIds([]);
    },
    [commitPages],
  );

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
      setSelectedIds([]);
    },
    [activePageIndex, commitPages],
  );

  const requestRemovePageAt = useCallback((index: number) => {
    setPageDeleteIndex(index);
    setPageDeleteOpen(true);
  }, []);

  const requestRemoveCurrentPageForAi = useCallback(() => {
    requestRemovePageAt(activePageIndex);
  }, [activePageIndex, requestRemovePageAt]);

  const confirmRemovePageAt = useCallback(() => {
    if (pageDeleteIndex != null) removePageAt(pageDeleteIndex);
    setPageDeleteOpen(false);
    setPageDeleteIndex(null);
  }, [pageDeleteIndex, removePageAt]);

  const duplicatePageAt = useCallback(
    (index: number) => {
      commitPages((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const dup = duplicateBookEditorPage(prev[index]);
        const next = [...prev.slice(0, index + 1), dup, ...prev.slice(index + 1)];
        return applyAutoSlideNamesByIndex(next.map((p, i) => ({ ...p, sortOrder: i })));
      });
      setPageIndex(index + 1);
      setSelectedIds([]);
    },
    [commitPages],
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
    if (canvasSelectedIds.length !== 1 || !currentPage) return null;
    const id = canvasSelectedIds[0];
    return currentPage.elements.find((e) => e.id === id) ?? null;
  }, [canvasSelectedIds, currentPage]);

  const layoutAiMediaSelection = useMemo(() => {
    if (!selectedEl) return null;
    if (selectedEl.type !== "image" && selectedEl.type !== "video") return null;
    return { elementId: selectedEl.id, kind: selectedEl.type };
  }, [selectedEl]);

  const widgetDeleteKindLabel = useMemo(() => {
    if (widgetDeleteIds.length === 0 || !currentPage) return "위젯";
    if (widgetDeleteIds.length > 1) return `${widgetDeleteIds.length}개 위젯`;
    const el = currentPage.elements.find((e) => e.id === widgetDeleteIds[0]);
    if (!el) return "위젯";
    if (el.type === "text") return "텍스트 위젯";
    if (el.type === "image") return "이미지 위젯";
    if (el.type === "video") return "동영상 위젯";
    if (el.type === "weather") return "날씨 위젯";
    if (el.type === "digitalClock") return "디지털 시계 위젯";
    if (el.type === "drawing") return "그리기";
    return "위젯";
  }, [widgetDeleteIds, currentPage]);

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
    <>
      <BookWorkspaceShell
        titleArea={
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
            <Input
              className="h-9 min-w-[10rem] max-w-md flex-1 rounded-md border-transparent bg-transparent pl-3 pr-2 text-base font-semibold shadow-none transition-colors placeholder:text-muted-foreground/60 hover:bg-muted/25 focus-visible:bg-muted/20 focus-visible:ring-1 focus-visible:ring-ring/50 sm:text-lg"
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
          <Button
            type="button"
            size="sm"
            className="border-transparent bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500/40 disabled:opacity-100"
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
        }
        left={
          <div className="flex h-full min-h-0 w-full min-w-0 flex-row">
            <BookEditorToolRail
              activeTab={leftDockTab}
              onActiveTabChange={setLeftDockTab}
              mediaLibraryEnabled={false}
            />
            <div className={bookLeftDockContentColumnClass("border-s border-border/40")}>
              {leftDockTab === "page" ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <BookPageSidebar
                    fluid
                    pageCount={pages.length}
                    pageKeys={pageKeys}
                    thumbnailsByKey={slideThumbnails}
                    activeIndex={activePageIndex}
                    pageLabels={pageLabels}
                    onSelectPage={(i) => {
                      setPageIndex(i);
                      setSelectedIds([]);
                    }}
                    mode="edit"
                    onReorderPages={reorderPages}
                    onAddPage={addPage}
                    onAddPageAtInsertIndex={addPageAtInsertIndex}
                    onRemovePageAtIndex={requestRemovePageAt}
                    onDuplicatePageAtIndex={duplicatePageAt}
                    canRemovePage={pages.length > 1}
                  />
                </div>
              ) : null}
              {leftDockTab === "widgets" ? (
                <BookWidgetPalette
                  variant="docked"
                  className="min-h-0 flex-1"
                  onRequestFloat={() => persistWidgetFloatingOpen(true)}
                />
              ) : null}
              {leftDockTab === "templates" ? (
                <BookSlideTemplatesPanel
                  className="min-h-0 flex-1"
                  onApplyTemplate={applySlideTemplate}
                />
              ) : null}
              {leftDockTab === "drawing" ? (
                <BookSlideDrawingPanel
                  className="min-h-0 flex-1"
                  strokeColor={drawingStrokeColor}
                  strokeWidth={drawingStrokeWidth}
                  onStrokeColorChange={setDrawingStrokeColor}
                  onStrokeWidthChange={setDrawingStrokeWidth}
                />
              ) : null}
            </div>
          </div>
        }
        center={
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 justify-start border-b border-border/60 bg-muted/15 px-2 py-2 sm:px-3">
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
                  centerGuideThresholdPx={centerGuideThresholdPx}
                  onCenterGuideThresholdPxChange={setCenterGuideThresholdPx}
                  dragGridPx={dragGridPx}
                  onDragGridPxChange={setDragGridPx}
                />
              </div>
              <div
                ref={canvasWrapRef}
                className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 pb-24"
                onWheel={handleWheel}
                onPointerDown={(e) => {
                  const slide = (e.currentTarget as HTMLElement).querySelector(
                    "[data-book-slide-root]",
                  );
                  if (slide?.contains(e.target as Node)) return;
                  setSelectedIds([]);
                }}
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
                    selectedIds={canvasSelectedIds}
                    onSelect={handleCanvasSelect}
                    onElementChange={onElementChange}
                    onDropWidget={onDropWidget}
                    onReorderZ={onReorderZ}
                    onDeleteElement={requestRemoveWidget}
                    centerGuideThresholdPx={centerGuideThresholdPx}
                    dragGridPx={dragGridPx}
                    editInteractionTool={leftDockTab === "drawing" ? "draw" : "default"}
                    drawingStrokeColor={drawingStrokeColor}
                    drawingStrokeWidth={drawingStrokeWidth}
                    onAppendElement={onAppendDrawingElement}
                  />
                ) : null}
              </div>
            </div>
            {floatingWidgetPaletteOpen ? (
              <BookWidgetPalette
                variant="floating"
                onClose={() => persistWidgetFloatingOpen(false)}
              />
            ) : null}
            {currentPage ? (
              <BookAiAssistantPanel
                slideWidth={slideWidth}
                slideHeight={slideHeight}
                pageCount={pages.length}
                activePageIndex={activePageIndex}
                onApplyElements={applyAiElements}
                onApplyPageBackground={updateCurrentPageBackground}
                onApplyPageTitle={applyPageTitleFromAi}
                onApplyBookTitle={setTitle}
                onAddPages={addPagesFromAi}
                onUndo={undo}
                onRedo={redo}
                onRequestRemoveCurrentPage={requestRemoveCurrentPageForAi}
                onApplySlideDimensions={applySlideDimensionsFromAi}
                layoutAiMediaSelection={layoutAiMediaSelection}
                onPatchBookElement={onElementChange}
              />
            ) : null}
          </>
        }
        right={
          currentPage ? (
            <aside className="flex h-full min-h-0 w-96 shrink-0 flex-col overflow-hidden border-l border-border bg-card/50">
              <BookLayersPanel
                elements={currentPage.elements}
                selectedIds={canvasSelectedIds}
                onSelect={handleLayerSelect}
                onReorderZ={onReorderZ}
                onLayerDragReorder={onLayerDragReorder}
                onVisibilityChange={onLayerVisibilityChange}
                onLockChange={onLayerLockChange}
                onRequestDelete={requestRemoveWidget}
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                {canvasSelectedIds.length >= 2 ? (
                  <BookInspectorPanel
                    embedded
                    selected={null}
                    multiSelectionCount={canvasSelectedIds.length}
                    slideWidth={slideWidth}
                    slideHeight={slideHeight}
                    onChange={onElementChange}
                    onDelete={removeSelectedBulk}
                    mediaHint={mediaHint}
                  />
                ) : canvasSelectedIds.length === 1 ? (
                  <BookInspectorPanel
                    embedded
                    selected={selectedEl}
                    slideWidth={slideWidth}
                    slideHeight={slideHeight}
                    onChange={onElementChange}
                    onDelete={removeSelected}
                    mediaHint={mediaHint}
                  />
                ) : (
                  <BookPagePropertiesPanel
                    embedded
                    pageIndex={activePageIndex}
                    totalPages={pages.length}
                    name={currentPage.name}
                    onChangeName={updateCurrentPageName}
                    backgroundColor={
                      currentPage.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND
                    }
                    onChangeBackgroundColor={updateCurrentPageBackground}
                  />
                )}
              </div>
            </aside>
          ) : null
        }
      />
      <AlertDialog
        open={widgetDeleteOpen}
        onOpenChange={(open) => {
          setWidgetDeleteOpen(open);
          if (!open) setWidgetDeleteIds([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>위젯을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 슬라이드에서 「{widgetDeleteKindLabel}」을(를) 제거합니다.
              {widgetDeleteIds.length > 1 ? " 선택한 위젯이 모두 삭제됩니다." : ""} 실행 후에는 되돌리기(Ctrl+Z)로
              복구할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => confirmRemoveWidget()}>
              삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pageDeleteOpen}
        onOpenChange={(open) => {
          setPageDeleteOpen(open);
          if (!open) setPageDeleteIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>슬라이드를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              「
              {pageDeleteIndex != null && pages[pageDeleteIndex]
                ? pages[pageDeleteIndex].name.trim() || `슬라이드 ${pageDeleteIndex + 1}`
                : "이 슬라이드"}
              」와 이 페이지에 있는 모든 위젯이 제거됩니다. 되돌리기(Ctrl+Z)로 복구할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">취소</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => confirmRemovePageAt()}>
              삭제
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

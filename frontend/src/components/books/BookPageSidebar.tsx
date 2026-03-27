import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, FileStack, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenuFloatingItem,
  ContextMenuFloatingPanel,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { slideDisplayLabel } from "@/lib/book-canvas";
import { cn } from "@/lib/utils";

type BookPageSidebarProps = {
  pageCount: number;
  /** 정렬·애니메이션용 안정 id; 편집+재정렬 시 pageCount와 길이가 같아야 함 */
  pageKeys?: string[];
  /** `pageKeys[i]`와 동일한 키로 조회하는 슬라이드 미리보기(data URL) */
  thumbnailsByKey?: Record<string, string | undefined>;
  activeIndex: number;
  onSelectPage: (index: number) => void;
  mode: "view" | "edit";
  /** 길이는 pageCount와 같아야 함. 없으면 "슬라이드 n" */
  pageLabels?: string[];
  /** 편집 모드에서만; 슬라이드를 `from`에서 `to` 위치로 이동 */
  onReorderPages?: (fromIndex: number, toIndex: number) => void;
  onAddPage?: () => void;
  /** 편집 모드: 인덱스별 삭제(하단 버튼·우클릭 메뉴) */
  onRemovePageAtIndex?: (index: number) => void;
  canRemovePage?: boolean;
  /** 편집 모드: 우클릭 — 복사본을 해당 페이지 바로 아래에 삽입 */
  onDuplicatePageAtIndex?: (index: number) => void;
};

function slideRowClass(active: boolean) {
  return cn(
    "block min-w-0 w-full rounded-lg border p-1.5 text-left transition-colors",
    active
      ? "border-primary bg-primary/10 font-medium text-foreground shadow-sm ring-1 ring-primary/15"
      : "border-border/50 bg-muted/25 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
  );
}

/** 16:9 영역을 이미지(또는 배경)로 꽉 채우고, 상단에 제목 오버레이 + 하단 번호 */
function SlideCardPreview({
  thumbUrl,
  index,
  label,
}: {
  thumbUrl?: string;
  index: number;
  label: string;
}) {
  return (
    <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-border/80 dark:bg-black dark:ring-border">
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-1.5 pb-6 pt-1">
        <span
          className={cn(
            "line-clamp-2 max-w-full text-left text-[10px] font-semibold leading-tight",
            thumbUrl
              ? "inline-block rounded bg-black/55 px-1 py-0.5 text-white"
              : "text-foreground",
          )}
        >
          {label}
        </span>
      </div>
      <span className="absolute bottom-1 left-1 z-10 rounded bg-black/65 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-sm">
        {index + 1}
      </span>
    </div>
  );
}

function SortableSlideRow({
  id,
  index,
  activeIndex,
  label,
  thumbUrl,
  onSelect,
  onRemovePageAtIndex,
  canRemovePage,
  onDuplicatePageAtIndex,
}: {
  id: string;
  index: number;
  activeIndex: number;
  label: string;
  thumbUrl?: string;
  onSelect: (i: number) => void;
  onRemovePageAtIndex?: (i: number) => void;
  canRemovePage?: boolean;
  onDuplicatePageAtIndex?: (i: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [ctxPoint, setCtxPoint] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxPoint) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxPoint(null);
    };

    const onPointerDownCapture = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setCtxPoint(null);
    };

    const raf = window.requestAnimationFrame(() => {
      window.addEventListener("pointerdown", onPointerDownCapture, true);
    });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ctxPoint]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rowClass = cn(
    "flex min-w-0 items-stretch gap-0.5 rounded-md border border-transparent p-0.5",
    "cursor-grab touch-none active:cursor-grabbing",
    isDragging && "relative z-[1] opacity-[0.35]",
  );

  const ctxEnabled = onRemovePageAtIndex != null || onDuplicatePageAtIndex != null;

  const onRowContextMenu = ctxEnabled
    ? (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxPoint({ x: e.clientX, y: e.clientY });
      }
    : undefined;

  const menuPortal =
    ctxPoint && ctxEnabled
      ? createPortal(
          <ContextMenuFloatingPanel
            ref={menuRef}
            className="animate-in fade-in-0 zoom-in-95 flex min-w-[11rem] flex-col gap-0.5"
            style={{
              position: "fixed",
              left: Math.min(
                ctxPoint.x,
                typeof window !== "undefined" ? Math.max(8, window.innerWidth - 200) : ctxPoint.x,
              ),
              top: Math.min(
                ctxPoint.y,
                typeof window !== "undefined" ? Math.max(8, window.innerHeight - 120) : ctxPoint.y,
              ),
            }}
          >
            {onDuplicatePageAtIndex ? (
              <div className="flex flex-col gap-0.5" role="group" aria-label="복사">
                <ContextMenuFloatingItem
                  onClick={() => {
                    onDuplicatePageAtIndex(index);
                    setCtxPoint(null);
                  }}
                >
                  <Copy className="size-4" aria-hidden />
                  페이지 복사
                </ContextMenuFloatingItem>
              </div>
            ) : null}
            {onDuplicatePageAtIndex && onRemovePageAtIndex ? (
              <div
                className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                role="separator"
                aria-hidden="true"
              />
            ) : null}
            {onRemovePageAtIndex ? (
              <div className="flex flex-col gap-0.5" role="group" aria-label="삭제">
                <ContextMenuFloatingItem
                  variant="destructive"
                  disabled={!canRemovePage}
                  onClick={() => {
                    if (!canRemovePage) return;
                    onRemovePageAtIndex(index);
                    setCtxPoint(null);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                  이 페이지 삭제
                </ContextMenuFloatingItem>
              </div>
            ) : null}
          </ContextMenuFloatingPanel>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={rowClass}
        onContextMenu={onRowContextMenu}
        {...attributes}
        {...listeners}
      >
        <button type="button" onClick={() => onSelect(index)} className={slideRowClass(index === activeIndex)}>
          <SlideCardPreview thumbUrl={thumbUrl} index={index} label={label} />
        </button>
      </div>
      {menuPortal}
    </>
  );
}

function StaticSlideRow({
  index,
  activeIndex,
  label,
  thumbUrl,
  onSelect,
}: {
  index: number;
  activeIndex: number;
  label: string;
  thumbUrl?: string;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex min-w-0 items-stretch gap-0.5 rounded-md border border-transparent p-0.5">
      <button type="button" onClick={() => onSelect(index)} className={slideRowClass(index === activeIndex)}>
        <SlideCardPreview thumbUrl={thumbUrl} index={index} label={label} />
      </button>
    </div>
  );
}

function DragOverlayRow({
  index,
  label,
  active,
  thumbUrl,
}: {
  index: number;
  label: string;
  active: boolean;
  thumbUrl?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 cursor-grabbing items-stretch gap-0.5 rounded-md border border-primary/40 bg-card p-0.5 shadow-lg",
      )}
    >
      <div className={cn(slideRowClass(active), "pointer-events-none min-w-0 w-full flex-1")}>
        <SlideCardPreview thumbUrl={thumbUrl} index={index} label={label} />
      </div>
    </div>
  );
}

export function BookPageSidebar({
  pageCount,
  pageKeys,
  thumbnailsByKey,
  activeIndex,
  onSelectPage,
  mode,
  pageLabels,
  onReorderPages,
  onAddPage,
  onRemovePageAtIndex,
  canRemovePage,
  onDuplicatePageAtIndex,
}: BookPageSidebarProps) {
  const edit = mode === "edit";
  const reorder = Boolean(edit && onReorderPages);

  const sortableIds = useMemo(() => {
    if (pageCount === 0) return [];
    return Array.from({ length: pageCount }, (_, i) => pageKeys?.[i] ?? `sidebar-fallback-${i}`);
  }, [pageCount, pageKeys]);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || !onReorderPages) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const oldIndex = sortableIds.indexOf(activeId);
    const newIndex = sortableIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderPages(oldIndex, newIndex);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const activeOverlayIndex = activeDragId ? sortableIds.indexOf(activeDragId) : -1;
  const overlayLabel =
    activeOverlayIndex >= 0
      ? slideDisplayLabel(pageLabels?.[activeOverlayIndex], activeOverlayIndex)
      : "";
  const thumbFor = (i: number) => {
    const k = pageKeys?.[i] ?? sortableIds[i];
    if (!k || !thumbnailsByKey) return undefined;
    return thumbnailsByKey[k];
  };

  const listBody =
    reorder && sortableIds.length > 0 ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5 p-2">
            {sortableIds.map((id, i) => (
              <SortableSlideRow
                key={id}
                id={id}
                index={i}
                activeIndex={activeIndex}
                label={slideDisplayLabel(pageLabels?.[i], i)}
                thumbUrl={thumbFor(i)}
                onSelect={onSelectPage}
                onRemovePageAtIndex={edit ? onRemovePageAtIndex : undefined}
                canRemovePage={canRemovePage}
                onDuplicatePageAtIndex={edit ? onDuplicatePageAtIndex : undefined}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" }}>
          {activeDragId != null && activeOverlayIndex >= 0 ? (
            <DragOverlayRow
              index={activeOverlayIndex}
              label={overlayLabel}
              active={activeOverlayIndex === activeIndex}
              thumbUrl={thumbFor(activeOverlayIndex)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    ) : (
      <div className="flex flex-col gap-2.5 p-2">
        {Array.from({ length: pageCount }, (_, i) => (
          <StaticSlideRow
            key={pageKeys?.[i] ?? `page-${i}`}
            index={i}
            activeIndex={activeIndex}
            label={slideDisplayLabel(pageLabels?.[i], i)}
            thumbUrl={
              pageKeys?.[i] && thumbnailsByKey
                ? thumbnailsByKey[pageKeys[i]!]
                : undefined
            }
            onSelect={onSelectPage}
          />
        ))}
      </div>
    );

  return (
    <aside className="flex h-full min-h-0 w-[13.75rem] shrink-0 flex-col border-r border-border bg-card/50 sm:w-[15.5rem]">
      <div
        className="flex items-center gap-2 border-b border-border px-2 py-2"
        title={reorder ? "슬라이드 줄 전체를 드래그해 순서를 바꿀 수 있습니다." : undefined}
      >
        <FileStack className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">페이지</span>
      </div>
      {reorder ? (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
          {listBody}
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">{listBody}</ScrollArea>
      )}
      {edit ? (
        <div className="flex shrink-0 flex-col gap-1 border-t border-border p-2">
          <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onAddPage}>
            <Plus className="mr-1 size-3.5" aria-hidden />
            페이지 추가
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canRemovePage || !onRemovePageAtIndex}
            onClick={() => onRemovePageAtIndex?.(activeIndex)}
          >
            <Trash2 className="mr-1 size-3.5" aria-hidden />
            현재 삭제
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

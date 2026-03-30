import { useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Clock,
  CloudSun,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Lock,
  Trash2,
  Type,
  Unlock,
  Video,
} from "lucide-react";
import {
  type BookCanvasElement,
  type ElementZOrderOp,
  isBookElementLocked,
  isBookElementVisible,
} from "@/lib/book-canvas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function bookElementLayerLabel(el: BookCanvasElement): string {
  switch (el.type) {
    case "text": {
      const t = el.text?.trim() ?? "";
      if (t) return t.length > 32 ? `${t.slice(0, 32)}…` : t;
      return "텍스트";
    }
    case "image":
      return "이미지";
    case "video":
      return "동영상";
    case "weather":
      return "날씨";
    case "digitalClock":
      return "디지털 시계";
    default:
      return "요소";
  }
}

function LayerTypeIcon({ el }: { el: BookCanvasElement }) {
  const cls = "size-3.5 shrink-0 text-muted-foreground";
  switch (el.type) {
    case "text":
      return <Type className={cls} aria-hidden />;
    case "image":
      return <ImageIcon className={cls} aria-hidden />;
    case "video":
      return <Video className={cls} aria-hidden />;
    case "weather":
      return <CloudSun className={cls} aria-hidden />;
    case "digitalClock":
      return <Clock className={cls} aria-hidden />;
    default:
      return <Layers className={cls} aria-hidden />;
  }
}

export type BookLayersPanelProps = {
  elements: BookCanvasElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorderZ?: (elementId: string, op: ElementZOrderOp) => void;
  /** 편집: 눈 아이콘으로 캔버스 표시 여부(저장됨) */
  onVisibilityChange?: (elementId: string, visible: boolean) => void;
  /** 편집: 자물쇠로 이동·변형·캔버스 삭제 막기(저장됨) */
  onLockChange?: (elementId: string, locked: boolean) => void;
  /** 편집: 확인 대화상자 후 슬라이드에서 제거 */
  onRequestDelete?: (elementId: string) => void;
  /** 보기 전용(게스트): 선택·순서 변경 없음 */
  readOnly?: boolean;
  /** 오른쪽 열 전체를 레이어만 쓸 때 스크롤 영역을 세로로 채움 */
  expandVertical?: boolean;
  className?: string;
};

/**
 * Polotno 스타일: 위가 앞쪽(위에 그려지는) 레이어, 아래가 뒤.
 * 배열은 [뒤 → 앞] 순서이므로 목록은 역순으로 표시합니다.
 */
export function BookLayersPanel({
  elements,
  selectedId,
  onSelect,
  onReorderZ,
  onVisibilityChange,
  onLockChange,
  onRequestDelete,
  readOnly = false,
  expandVertical = false,
  className,
}: BookLayersPanelProps) {
  const rev = useMemo(() => [...elements].reverse(), [elements]);
  const canReorder = Boolean(onReorderZ) && !readOnly;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col border-b border-border bg-card/40",
        expandVertical ? "flex-1 border-b-0" : "shrink-0",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/80 px-3 py-2">
        <Layers className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">레이어</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {elements.length}
        </span>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
          expandVertical ? "" : "max-h-[min(38vh,260px)]",
        )}
      >
        {rev.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            이 슬라이드에 위젯이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-px p-1.5" role="list">
            {rev.map((el, displayIndex) => {
              const isFront = displayIndex === 0;
              const isBack = displayIndex === rev.length - 1;
              const selected = el.id === selectedId;
              const showing = isBookElementVisible(el);
              const locked = isBookElementLocked(el);
              return (
                <li key={el.id}>
                  <div
                    className={cn(
                      "flex items-center gap-0.5 rounded-md border border-transparent px-1 py-0.5 transition-colors",
                      selected
                        ? "border-primary/35 bg-primary/10"
                        : "hover:bg-muted/60",
                      !showing && "opacity-[0.72]",
                      locked && "ring-1 ring-amber-500/25",
                    )}
                  >
                    {readOnly ? (
                      <span
                        className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
                        title={showing ? "보이는 레이어" : "숨긴 레이어"}
                        aria-hidden
                      >
                        {showing ? (
                          <Eye className="size-3.5" />
                        ) : (
                          <EyeOff className="size-3.5" />
                        )}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        title={showing ? "슬라이드에서 숨기기" : "다시 보이기"}
                        aria-label={
                          showing
                            ? `${bookElementLayerLabel(el)} 슬라이드에서 숨기기`
                            : `${bookElementLayerLabel(el)} 다시 보이기`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onVisibilityChange?.(el.id, !showing);
                        }}
                      >
                        {showing ? (
                          <Eye className="size-3.5" aria-hidden />
                        ) : (
                          <EyeOff className="size-3.5 opacity-80" aria-hidden />
                        )}
                      </Button>
                    )}
                    {readOnly ? (
                      <span
                        className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
                        title={locked ? "잠긴 레이어" : "잠금 없음"}
                        aria-hidden
                      >
                        {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5 opacity-40" />}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        title={locked ? "잠금 해제" : "잠그기"}
                        aria-label={
                          locked
                            ? `${bookElementLayerLabel(el)} 잠금 해제`
                            : `${bookElementLayerLabel(el)} 잠그기`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onLockChange?.(el.id, !locked);
                        }}
                      >
                        {locked ? (
                          <Lock className="size-3.5 text-amber-700 dark:text-amber-400" aria-hidden />
                        ) : (
                          <Unlock className="size-3.5 opacity-70" aria-hidden />
                        )}
                      </Button>
                    )}
                    {readOnly ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-xs">
                        <LayerTypeIcon el={el} />
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {bookElementLayerLabel(el)}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-xs"
                        onClick={() => onSelect(el.id)}
                      >
                        <LayerTypeIcon el={el} />
                        <span
                          className={cn(
                            "min-w-0 truncate font-medium text-foreground",
                            !showing && "line-through decoration-muted-foreground/70",
                          locked && "text-amber-900/90 dark:text-amber-100/90",
                          )}
                        >
                          {bookElementLayerLabel(el)}
                        </span>
                      </button>
                    )}
                    {!readOnly && onRequestDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="이 슬라이드에서 삭제"
                        aria-label={`${bookElementLayerLabel(el)} 삭제`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestDelete(el.id);
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                    {canReorder && onReorderZ ? (
                      <div className="flex shrink-0 items-center gap-0.5 pr-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="한 단계 앞으로"
                          aria-label={`${bookElementLayerLabel(el)} 한 단계 앞으로`}
                          disabled={isFront || locked}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorderZ(el.id, "forward");
                          }}
                        >
                          <ChevronUp className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="한 단계 뒤로"
                          aria-label={`${bookElementLayerLabel(el)} 한 단계 뒤로`}
                          disabled={isBack || locked}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorderZ(el.id, "backward");
                          }}
                        >
                          <ChevronDown className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="맨 앞으로"
                          aria-label={`${bookElementLayerLabel(el)} 맨 앞으로`}
                          disabled={isFront || locked}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorderZ(el.id, "front");
                          }}
                        >
                          <ChevronsUp className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          title="맨 뒤로"
                          aria-label={`${bookElementLayerLabel(el)} 맨 뒤로`}
                          disabled={isBack || locked}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorderZ(el.id, "back");
                          }}
                        >
                          <ChevronsDown className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[10px] leading-snug text-muted-foreground">
        {readOnly
          ? "위쪽이 화면 앞 순서입니다. 눈·자물쇠 아이콘은 숨김·잠금 상태를 뜻합니다."
          : "위쪽이 앞 순서입니다. 눈=표시, 자물쇠=편집 잠금, 휴지통=삭제(저장 시 반영). 잠긴 레이어는 캔버스에서 옮기거나 지울 수 없습니다."}
      </p>
    </div>
  );
}

import { Minus, Plus, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CENTER_GUIDE_THRESHOLD_MIN = 1;
const CENTER_GUIDE_THRESHOLD_MAX = 200;
const DRAG_GRID_PX_MIN = 1;
const DRAG_GRID_PX_MAX = 128;

type Props = {
  className?: string;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  showUndoRedo?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** 편집 모드: 가운데 기준선이 뜨는 거리(논리 px) */
  centerGuideThresholdPx?: number;
  onCenterGuideThresholdPxChange?: (px: number) => void;
  /** 편집 모드: 드래그 스냅 그리드 간격(논리 px) */
  dragGridPx?: number;
  onDragGridPxChange?: (px: number) => void;
};

export function BookCanvasToolbar({
  className,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  showUndoRedo = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  centerGuideThresholdPx,
  onCenterGuideThresholdPxChange,
  dragGridPx,
  onDragGridPxChange,
}: Props) {
  const showCenterGuideControl =
    typeof centerGuideThresholdPx === "number" &&
    typeof onCenterGuideThresholdPxChange === "function";
  const showDragGridControl =
    typeof dragGridPx === "number" && typeof onDragGridPxChange === "function";
  const showSnapControlsDividerBeforeZoom = showCenterGuideControl || showDragGridControl;

  return (
    <div
      className={cn(
        "pointer-events-auto z-10 flex items-center gap-0.5 rounded-xl border border-border/80 bg-card/95 px-2 py-1.5 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-md dark:ring-white/[0.06]",
        className,
      )}
      role="toolbar"
      aria-label="캔버스 도구"
    >
      {showUndoRedo ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="실행 취소"
            title="실행 취소 (Ctrl+Z)"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="다시 실행"
            title="다시 실행 (Ctrl+Shift+Z)"
          >
            <Redo2 className="size-4" />
          </Button>
          <div className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        </>
      ) : null}
      {showCenterGuideControl || showDragGridControl ? (
        <div className="flex items-center gap-2 px-1">
          {showCenterGuideControl ? (
            <label className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-muted-foreground">중앙선</span>
              <Input
                type="number"
                inputMode="numeric"
                min={CENTER_GUIDE_THRESHOLD_MIN}
                max={CENTER_GUIDE_THRESHOLD_MAX}
                step={1}
                value={centerGuideThresholdPx}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  const clamped = Math.min(
                    CENTER_GUIDE_THRESHOLD_MAX,
                    Math.max(CENTER_GUIDE_THRESHOLD_MIN, Math.round(n)),
                  );
                  onCenterGuideThresholdPxChange(clamped);
                }}
                className="h-8 w-[3.25rem] px-1.5 text-center text-xs tabular-nums"
                aria-label="가운데 기준선이 나타나는 거리(논리 픽셀)"
                title="드래그할 때, 위젯 가운데가 슬라이드 가운데에서 이 거리 안이면 분홍 기준선이 보입니다"
              />
            </label>
          ) : null}
          {showCenterGuideControl && showDragGridControl ? (
            <div className="h-6 w-px bg-border" aria-hidden />
          ) : null}
          {showDragGridControl ? (
            <label className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-muted-foreground">그리드</span>
              <Input
                type="number"
                inputMode="numeric"
                min={DRAG_GRID_PX_MIN}
                max={DRAG_GRID_PX_MAX}
                step={1}
                value={dragGridPx}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  const clamped = Math.min(
                    DRAG_GRID_PX_MAX,
                    Math.max(DRAG_GRID_PX_MIN, Math.round(n)),
                  );
                  onDragGridPxChange(clamped);
                }}
                className="h-8 w-[3.25rem] px-1.5 text-center text-xs tabular-nums"
                aria-label="드래그 스냅 그리드 간격(논리 픽셀)"
                title="드래그할 때 위치가 이 간격(논리 px)의 배수로 맞춰집니다"
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {showSnapControlsDividerBeforeZoom ? (
        <div className="mx-0.5 h-6 w-px bg-border" aria-hidden />
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8 shrink-0"
        onClick={onZoomOut}
        aria-label="축소"
        title="축소 (Ctrl+휠)"
      >
        <Minus className="size-4" />
      </Button>
      <span className="min-w-[2.75rem] select-none text-center text-xs tabular-nums text-muted-foreground">
        {zoomPercent}%
      </span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-8 shrink-0"
        onClick={onZoomIn}
        aria-label="확대"
        title="확대 (Ctrl+휠)"
      >
        <Plus className="size-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 shrink-0 px-2 text-xs"
        onClick={onZoomReset}
        aria-label="줌 초기화"
      >
        맞춤
      </Button>
    </div>
  );
}

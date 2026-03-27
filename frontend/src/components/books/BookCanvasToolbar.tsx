import { Minus, Plus, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
}: Props) {
  return (
    <div
      className={cn(
        "pointer-events-auto z-10 flex items-center gap-1 rounded-lg border border-border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur-sm",
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

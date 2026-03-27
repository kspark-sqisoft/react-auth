import type { DragEvent } from "react";
import { Blocks, GripVertical, ImagePlus, Type, Video } from "lucide-react";
import { BOOK_WIDGET_DRAG_TYPE, type BookDropWidgetKind } from "@/components/books/BookSlideCanvas";
import { cn } from "@/lib/utils";

const ITEMS: { kind: BookDropWidgetKind; label: string; icon: typeof Type }[] = [
  { kind: "text", label: "텍스트", icon: Type },
  { kind: "image", label: "이미지", icon: ImagePlus },
  { kind: "video", label: "동영상", icon: Video },
];

/**
 * 슬라이드 위에 올려두는 위젯 팔레트 — 항목을 드래그해 캔버스에 놓습니다.
 */
export function BookWidgetPalette({ className }: { className?: string }) {
  const onDragStart = (e: DragEvent, kind: BookDropWidgetKind) => {
    e.dataTransfer.setData(BOOK_WIDGET_DRAG_TYPE, kind);
    e.dataTransfer.setData("text/plain", kind);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      className={cn(
        "pointer-events-auto fixed bottom-4 left-1/2 z-[220] flex w-[min(100vw-2rem,22rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-border bg-card/95 p-2.5 shadow-lg ring-1 ring-border/40 backdrop-blur-md",
        className,
      )}
      role="region"
      aria-label="위젯 팔레트"
    >
      <header className="flex items-start gap-2 border-b border-border/60 pb-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
          <Blocks className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="font-heading text-sm font-semibold leading-none tracking-tight text-foreground">
            위젯
          </h2>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            아래를 슬라이드로 끌어다 놓으세요
          </p>
        </div>
      </header>
      <div className="flex items-stretch justify-center gap-2 px-0.5">
        {ITEMS.map(({ kind, label, icon: Icon }) => (
          <div
            key={kind}
            draggable
            onDragStart={(e) => onDragStart(e, kind)}
            className="flex min-w-0 flex-1 cursor-grab select-none flex-col items-center gap-1 rounded-lg border border-border/80 bg-background/90 px-2 py-2 transition-colors active:cursor-grabbing hover:border-primary/35 hover:bg-muted/40 sm:px-3"
          >
            <GripVertical className="size-3 text-muted-foreground" aria-hidden />
            <Icon className="size-5 text-foreground" aria-hidden />
            <span className="text-center text-[10px] font-medium text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

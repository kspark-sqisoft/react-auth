import { SlidersHorizontal, Trash2 } from "lucide-react";
import type { BookCanvasElement } from "@/lib/book-canvas";
import {
  defaultTextWidgetBoxHeight,
  getTextWidgetDisplayHtml,
} from "@/lib/book-text-widget";
import { BookTextRichEditor } from "@/components/books/BookTextRichEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type BookInspectorPanelProps = {
  selected: BookCanvasElement | null;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  onDelete: () => void;
  mediaHint?: string | null;
};

function num(v: string, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function BookInspectorPanel({
  selected,
  onChange,
  onDelete,
  mediaHint,
}: BookInspectorPanelProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card/50">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">위젯 속성</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              캔버스에서 위젯을 선택하면 여기서 글자·위치·크기를 바꿀 수 있습니다.
            </p>
          ) : selected.type === "text" ? (
            <>
              <div className="space-y-1">
                <Label>내용 (리치 텍스트)</Label>
                <BookTextRichEditor
                  widgetKey={selected.id}
                  html={getTextWidgetDisplayHtml(selected)}
                  onRichPatch={(p) =>
                    onChange(selected.id, { richHtml: p.richHtml, text: p.text })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="insp-fs">크기</Label>
                  <Input
                    id="insp-fs"
                    type="number"
                    min={10}
                    max={120}
                    value={selected.fontSize}
                    onChange={(e) =>
                      onChange(selected.id, {
                        fontSize: num(e.target.value, selected.fontSize, 10, 120),
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="insp-fill">색</Label>
                  <Input
                    id="insp-fill"
                    type="color"
                    className="h-9 cursor-pointer px-1"
                    value={selected.fill.startsWith("#") ? selected.fill : "#111827"}
                    onChange={(e) => onChange(selected.id, { fill: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="insp-tw">줄 너비</Label>
                <Input
                  id="insp-tw"
                  type="number"
                  min={80}
                  max={2000}
                  value={selected.width ?? 640}
                  onChange={(e) =>
                    onChange(selected.id, {
                      width: num(e.target.value, selected.width ?? 640, 80, 2000),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="insp-th">박스 높이</Label>
                <Input
                  id="insp-th"
                  type="number"
                  min={28}
                  max={4000}
                  value={Math.round(
                    selected.height ?? defaultTextWidgetBoxHeight(selected.fontSize),
                  )}
                  onChange={(e) =>
                    onChange(selected.id, {
                      height: num(
                        e.target.value,
                        selected.height ?? defaultTextWidgetBoxHeight(selected.fontSize),
                        28,
                        4000,
                      ),
                    })
                  }
                />
              </div>
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          ) : selected.type === "image" ? (
            <>
              <p className="text-xs text-muted-foreground break-all">이미지: {selected.src}</p>
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground break-all">동영상: {selected.src}</p>
              {selected.posterSrc ? (
                <p className="text-xs text-muted-foreground break-all">포스터: {selected.posterSrc}</p>
              ) : null}
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          )}

          {selected ? (
            <Button type="button" variant="destructive" size="sm" className="w-full" onClick={onDelete}>
              <Trash2 className="mr-1.5 size-3.5" aria-hidden />
              위젯 삭제
            </Button>
          ) : null}

          {mediaHint ? <p className="text-xs text-amber-600 dark:text-amber-400">{mediaHint}</p> : null}
        </div>
      </ScrollArea>
    </aside>
  );
}

function PositionSizeFields({
  el,
  onChange,
}: {
  el: BookCanvasElement;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="insp-x">X</Label>
        <Input
          id="insp-x"
          type="number"
          value={Math.round(el.x)}
          onChange={(e) => onChange(el.id, { x: num(e.target.value, el.x, 0, 4000) })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="insp-y">Y</Label>
        <Input
          id="insp-y"
          type="number"
          value={Math.round(el.y)}
          onChange={(e) => onChange(el.id, { y: num(e.target.value, el.y, 0, 4000) })}
        />
      </div>
      {el.type !== "text" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="insp-w">너비</Label>
            <Input
              id="insp-w"
              type="number"
              min={24}
              value={Math.round(el.width)}
              onChange={(e) =>
                onChange(el.id, { width: num(e.target.value, el.width, 24, 4000) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="insp-h">높이</Label>
            <Input
              id="insp-h"
              type="number"
              min={24}
              value={Math.round(el.height)}
              onChange={(e) =>
                onChange(el.id, { height: num(e.target.value, el.height, 24, 4000) })
              }
            />
          </div>
        </>
      ) : (
        <>
          <div className="col-span-2 text-xs text-muted-foreground">
            텍스트 박스 크기는 캔버스에서 모서리를 드래그하거나 &quot;줄 너비&quot;로 조절합니다.
          </div>
        </>
      )}
    </div>
  );
}

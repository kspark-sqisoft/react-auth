import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DEFAULT_PAGE_BACKGROUND, slideDisplayLabel } from "@/lib/book-canvas";
import { BOOK_HEX_COLOR_PRESETS } from "@/lib/book-color-presets";
import {
  bookDockedPanelHeaderIconClass,
  bookDockedPanelHeaderRowClass,
  bookDockedPanelHeadingClass,
  bookDockedPanelRootClass,
} from "@/lib/book-workspace-ui";
import { cn } from "@/lib/utils";

type BookPagePropertiesPanelProps = {
  pageIndex: number;
  totalPages: number;
  name: string;
  onChangeName: (name: string) => void;
  backgroundColor: string;
  onChangeBackgroundColor: (color: string) => void;
  /** 레이어 패널과 같은 컬럼에 넣을 때 */
  embedded?: boolean;
};

function hexForColorInput(css: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(css) ? css : DEFAULT_PAGE_BACKGROUND;
}

export function BookPagePropertiesPanel({
  pageIndex,
  totalPages,
  name,
  onChangeName,
  backgroundColor,
  onChangeBackgroundColor,
  embedded = false,
}: BookPagePropertiesPanelProps) {
  const preview = slideDisplayLabel(name, pageIndex);
  const pickerValue = hexForColorInput(backgroundColor.trim());

  const Root = embedded ? "div" : "aside";
  return (
    <Root
      className={cn(
        bookDockedPanelRootClass("max-h-full"),
        embedded ? "min-w-0" : "w-80 shrink-0 border-l border-border/70",
      )}
    >
      <div className={bookDockedPanelHeaderRowClass()}>
        <LayoutTemplate className={bookDockedPanelHeaderIconClass()} aria-hidden />
        <span className={bookDockedPanelHeadingClass()}>페이지 속성</span>
      </div>
      <div className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="space-y-4 p-3">
          <p className="rounded-md border border-border/50 bg-muted/[0.06] px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
            슬라이드 크기는 상단 바의 캔버스 W·H에서 바꿀 수 있습니다.
          </p>
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">이 슬라이드</p>
            <p className="text-xs text-muted-foreground">
              목록에서 선택한 페이지 ({pageIndex + 1} / {totalPages})
            </p>
            <Label htmlFor="page-name">슬라이드 이름</Label>
            <Input
              id="page-name"
              value={name}
              onChange={(e) => onChangeName(e.target.value.slice(0, 120))}
              placeholder={`슬라이드 ${pageIndex + 1}`}
              maxLength={120}
            />
            <p className="text-[11px] text-muted-foreground">목록 표시: {preview}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="page-bg-hex">슬라이드 배경색</Label>
            <p className="text-[11px] text-muted-foreground">자주 쓰는 색</p>
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1">
              {BOOK_HEX_COLOR_PRESETS.map((c) => {
                const active =
                  backgroundColor.trim().replace(/\s/g, "").toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`배경 ${c}`}
                    aria-pressed={active}
                    className={cn(
                      "size-7 shrink-0 rounded-md border border-border shadow-sm ring-offset-background hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                      active && "ring-2 ring-primary ring-offset-2",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => onChangeBackgroundColor(c)}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="page-bg-picker"
                type="color"
                value={pickerValue}
                onChange={(e) => onChangeBackgroundColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-md border border-border bg-background"
                aria-label="배경 색 선택"
              />
              <Input
                id="page-bg-hex"
                className="min-w-0 flex-1 font-mono text-xs"
                value={backgroundColor}
                onChange={(e) => onChangeBackgroundColor(e.target.value.slice(0, 64))}
                placeholder="#ffffff 또는 rgb(…)"
                maxLength={64}
                spellCheck={false}
                aria-label="배경 색 코드"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onChangeBackgroundColor(DEFAULT_PAGE_BACKGROUND)}
            >
              배경을 기본(흰색)으로
            </Button>
            <p className="text-[11px] text-muted-foreground">
              #RRGGBB, rgb(), hsl() 등 브라우저가 이해하는 색 문자열을 쓸 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </Root>
  );
}

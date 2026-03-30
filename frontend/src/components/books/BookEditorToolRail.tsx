import { Blocks, FileStack, ImagePlus, LayoutTemplate, Pencil } from "lucide-react";
import type { BookEditorLeftTab } from "@/lib/book-editor-panel-events";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const railBtn = cn(
  "relative size-10 shrink-0 rounded-lg border border-transparent text-muted-foreground transition-colors",
  "hover:bg-accent/80 hover:text-accent-foreground",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const railBtnActive = cn(
  "border-primary/35 bg-primary/12 text-primary shadow-sm",
  "hover:bg-primary/15 hover:text-primary",
);

export type BookEditorToolRailProps = {
  className?: string;
  activeTab: BookEditorLeftTab;
  onActiveTabChange: (tab: BookEditorLeftTab) => void;
  mediaLibraryEnabled?: boolean;
  mediaDisabledHint?: string;
};

/** 워크스페이스 최좌측 세로 탭 — 페이지 / 위젯 / 미디어 / 템플릿 / 드로잉 */
export function BookEditorToolRail({
  className,
  activeTab,
  onActiveTabChange,
  mediaLibraryEnabled = true,
  mediaDisabledHint = "북을 저장한 뒤 이 화면에서 미디어 라이브러리를 쓸 수 있어요.",
}: BookEditorToolRailProps) {
  return (
    <TooltipProvider delayDuration={400}>
      <nav
        className={cn(
          "flex w-[52px] shrink-0 flex-col items-center gap-1 border-e border-border/70 bg-card/40 py-2 backdrop-blur-sm",
          className,
        )}
        aria-label="편집 메뉴"
      >
        <RailTooltip label="페이지 — 슬라이드 목록 (이름·배경은 오른쪽 패널)">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "page" && railBtnActive)}
            aria-pressed={activeTab === "page"}
            onClick={() => onActiveTabChange("page")}
          >
            <FileStack className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
        <RailTooltip label="위젯 — 텍스트·이미지·동영상 등을 슬라이드로 끌어 넣기">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "widgets" && railBtnActive)}
            aria-pressed={activeTab === "widgets"}
            onClick={() => onActiveTabChange("widgets")}
          >
            <Blocks className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
        <RailTooltip
          label={
            mediaLibraryEnabled
              ? "미디어 라이브러리 — 업로드·재사용"
              : mediaDisabledHint
          }
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              railBtn,
              activeTab === "media" && mediaLibraryEnabled && railBtnActive,
            )}
            aria-pressed={activeTab === "media"}
            disabled={!mediaLibraryEnabled}
            onClick={() => {
              if (mediaLibraryEnabled) onActiveTabChange("media");
            }}
          >
            <ImagePlus className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>

        <div className="my-1 h-px w-7 bg-border/80" role="separator" />

        <RailTooltip label="템플릿 — 슬라이드에 제목·본문 등 예시 블록 추가">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "templates" && railBtnActive)}
            aria-pressed={activeTab === "templates"}
            onClick={() => onActiveTabChange("templates")}
          >
            <LayoutTemplate className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
        <RailTooltip label="드로잉 — 슬라이드에서 자유 곡선 그리기">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(railBtn, activeTab === "drawing" && railBtnActive)}
            aria-pressed={activeTab === "drawing"}
            onClick={() => onActiveTabChange("drawing")}
          >
            <Pencil className="size-[22px]" aria-hidden />
          </Button>
        </RailTooltip>
      </nav>
    </TooltipProvider>
  );
}

function RailTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-[240px] text-left leading-snug">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

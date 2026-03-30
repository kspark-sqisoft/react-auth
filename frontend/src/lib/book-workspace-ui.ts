import { cn } from "@/lib/utils";

/**
 * 북 편집/보기 워크스페이스 — 도킹 패널·헤더를 한 톤으로 맞출 때 사용.
 * (전문가용 툴 느낌: 얇은 구분선, 읽기 쉬운 제목 계층)
 */

export function bookDockedPanelRootClass(className?: string) {
  return cn("flex h-full min-h-0 flex-col overflow-hidden bg-card/50", className);
}

export function bookDockedPanelHeaderRowClass(className?: string) {
  return cn(
    "flex shrink-0 items-center gap-2.5 border-b border-border/70 bg-muted/[0.07] px-3 py-2.5 backdrop-blur-[8px]",
    className,
  );
}

/** 헤더 제목 — 본문 톤에 가깝게 */
export function bookDockedPanelHeadingClass(className?: string) {
  return cn("text-xs font-semibold tracking-tight text-foreground", className);
}

export function bookDockedPanelHeaderIconClass(className?: string) {
  return cn("size-4 shrink-0 text-muted-foreground opacity-[0.92]", className);
}

/** 툴레일 오른쪽 탭 콘텐츠 열 */
export function bookLeftDockContentColumnClass(className?: string) {
  return cn(
    "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border/50 bg-gradient-to-b from-muted/[0.08] via-card/30 to-card/40 sm:max-w-[24rem]",
    className,
  );
}

/** 패널 하단 액션 바(페이지 추가 등) */
export function bookDockedPanelFooterClass(className?: string) {
  return cn(
    "flex shrink-0 flex-col gap-2 border-t border-border/70 bg-muted/[0.04] p-3 backdrop-blur-[6px]",
    className,
  );
}

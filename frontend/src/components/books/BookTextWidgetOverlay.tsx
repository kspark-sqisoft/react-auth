import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { BookCanvasElement } from "@/lib/book-canvas";
import { getTextWidgetDisplayHtml, textWidgetHitHeight } from "@/lib/book-text-widget";

type Props = {
  el: Extract<BookCanvasElement, { type: "text" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  /** 논리 높이(px) — 콘텐츠에 맞춤(편집 모드). */
  onReportLogicalHeight?: (logicalPx: number) => void;
};

export function BookTextWidgetOverlay({
  el,
  scale,
  mode,
  isSelected,
  onReportLogicalHeight,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const html = getTextWidgetDisplayHtml(el);
  const w = el.width ?? 720;
  const h = textWidgetHitHeight(el);

  useLayoutEffect(() => {
    if (mode !== "edit" || !onReportLogicalHeight) return;
    const node = rootRef.current;
    if (!node) return;

    const measure = () => {
      const sh = node.scrollHeight;
      if (sh <= 0) return;
      const logical = sh / scale;
      onReportLogicalHeight(logical);
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(node);
    return () => ro.disconnect();
  }, [html, scale, mode, onReportLogicalHeight, w]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "pointer-events-none absolute overflow-hidden rounded-sm",
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: w * scale,
        height: h * scale,
        fontSize: el.fontSize * scale,
        color: el.fill?.startsWith("#") ? el.fill : "#111827",
        lineHeight: 1.35,
      }}
    >
      <div
        className={cn(
          "book-text-widget-content h-full min-h-0 select-none overflow-hidden text-left [&_blockquote]:border-s-2 [&_blockquote]:border-border/80 [&_blockquote]:ps-2 [&_blockquote]:italic",
          "[&_code]:rounded [&_code]:bg-muted/80 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
          "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted/80 [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.85em]",
          "[&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:ps-4",
          "[&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:ps-4",
          "[&_h2]:mt-1 [&_h2]:mb-0.5 [&_h2]:text-[1.15em] [&_h2]:font-semibold",
          "[&_h3]:mt-1 [&_h3]:mb-0.5 [&_h3]:text-[1.05em] [&_h3]:font-semibold",
          "[&_p]:my-0.5 [&_p]:min-h-[1em]",
          "[&_a]:text-primary [&_a]:underline",
          "[&_hr]:my-2 [&_hr]:border-border",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

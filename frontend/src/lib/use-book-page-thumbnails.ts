import { useEffect, useMemo, useRef, useState } from "react";
import {
  captureBookSlideToDataURL,
  pageSnapshotSignature,
  type BookSlideSnapshotPage,
} from "@/lib/book-slide-snapshot";

const DEBOUNCE_MS = 320;

/**
 * 각 슬라이드의 시각적 내용이 바뀌면(디바운스 후) PNG 데이터 URL 썸네일을 다시 만듭니다.
 * `clientKey`로 `Record` 키를 맞춥니다.
 */
export function useBookPageThumbnails(
  pages: Array<BookSlideSnapshotPage & { clientKey: string }>,
  slideWidth: number,
  slideHeight: number,
): Record<string, string> {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const sigRef = useRef<Record<string, string>>({});

  const captureKey = useMemo(
    () =>
      `${slideWidth}x${slideHeight}:` +
      pages.map((p) => `${p.clientKey}:${pageSnapshotSignature(p)}`).join("\n"),
    [pages, slideWidth, slideHeight],
  );

  useEffect(() => {
    let cancelled = false;
    const validKeys = new Set(pages.map((p) => p.clientKey));

    const id = window.setTimeout(() => {
      void (async () => {
        const updates: Record<string, string> = {};

        for (const p of pages) {
          if (cancelled) return;
          const fullSig = `${slideWidth}x${slideHeight}:${pageSnapshotSignature(p)}`;
          if (sigRef.current[p.clientKey] === fullSig) continue;

          let url: string | null = null;
          try {
            url = await captureBookSlideToDataURL(p, slideWidth, slideHeight);
          } catch {
            url = null;
          }
          if (cancelled || !url) continue;
          sigRef.current[p.clientKey] = fullSig;
          updates[p.clientKey] = url;
        }

        if (cancelled) return;

        setThumbnails((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (!validKeys.has(k)) delete next[k];
          }
          Object.assign(next, updates);
          return next;
        });
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [captureKey, pages, slideWidth, slideHeight]);

  return thumbnails;
}

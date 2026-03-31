import {
  useCallback,
  useLayoutEffect,
  useState,
  type RefObject,
  type WheelEvent,
} from "react";

const MIN_USER_ZOOM = 0.25;
const MAX_USER_ZOOM = 4;

/**
 * ResizeObserver로 맞춤 비율(fit)을 구하고, 사용자 배율(zoom)을 곱해 캔버스에 넘길 display scale을 만듭니다.
 */
export function useBookCanvasDisplayScale(
  wrapRef: RefObject<HTMLElement | null>,
  opts: {
    slideWidth: number;
    slideHeight: number;
    bottomPad: number;
    /** 좌우 여백 합에 가깝게 빼는 값(기본 48). 미리보기 등에서 작게 줄여 슬라이드를 크게 맞춤 */
    horizontalPad?: number;
  },
) {
  const { slideWidth, slideHeight, bottomPad, horizontalPad = 48 } = opts;
  const [fitScale, setFitScale] = useState(0.55);
  const [zoomMul, setZoomMul] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cr = el.getBoundingClientRect();
      const s = Math.min(
        (cr.width - horizontalPad) / slideWidth,
        (cr.height - bottomPad) / slideHeight,
        1,
      );
      setFitScale(Math.max(0.22, Math.min(s, 1)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrapRef, slideWidth, slideHeight, bottomPad, horizontalPad]);

  const displayScale = fitScale * zoomMul;

  const zoomIn = useCallback(
    () =>
      setZoomMul((z) => Math.min(MAX_USER_ZOOM, Math.round(z * 1.15 * 1000) / 1000)),
    [],
  );
  const zoomOut = useCallback(
    () =>
      setZoomMul((z) => Math.max(MIN_USER_ZOOM, Math.round((z / 1.15) * 1000) / 1000)),
    [],
  );
  const zoomReset = useCallback(() => setZoomMul(1), []);

  const zoomPercent = Math.round(zoomMul * 100);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      if (e.deltaY > 0) zoomOut();
      else zoomIn();
    },
    [zoomIn, zoomOut],
  );

  return { displayScale, zoomPercent, zoomIn, zoomOut, zoomReset, handleWheel };
}

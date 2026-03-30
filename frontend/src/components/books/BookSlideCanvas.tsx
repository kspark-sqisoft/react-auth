/* eslint-disable react-refresh/only-export-components --
   Drag constants, types, and helpers are exported beside BookSlideCanvas for the editor. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { getBookImageIfReady, loadBookImage } from "@/lib/book-image-cache";
import { createPortal } from "react-dom";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { FolderOpen, Library, Pause, Play, Square } from "lucide-react";
import {
  ContextMenuFloatingItem,
  ContextMenuFloatingPanel,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import {
  BOOK_CANVAS_DRAG_GRID_PX,
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  canvasRoundRectPath,
  konvaBookTopLeftFromNode,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  resolveBookMediaObjectFit,
  snapKonvaBookNodePositionToGrid,
  buildBookDrawingElement,
  isBookElementLocked,
  isBookElementVisible,
  type BookCanvasElement,
  type ElementZOrderOp,
} from "@/lib/book-canvas";
import { publicAssetUrl } from "@/lib/api";
import {
  BookTextWidgetOverlay,
  type BookTextOverlayLiveFrame,
} from "@/components/books/BookTextWidgetOverlay";
import { BookDigitalClockWidgetOverlay } from "@/components/books/BookDigitalClockWidgetOverlay";
import { BookWeatherWidgetOverlay } from "@/components/books/BookWeatherWidgetOverlay";
import { computeKonvaFittedImageLayout, mediaObjectFitToCssClass } from "@/lib/book-media-layout";
import { defaultTextWidgetBoxHeight, textWidgetHitHeight } from "@/lib/book-text-widget";

function useBookImage(src: string) {
  const url = publicAssetUrl(src) ?? src;
  const cached = url ? getBookImageIfReady(src) : null;
  const [asyncForSrc, setAsyncForSrc] = useState<{
    src: string;
    img: HTMLImageElement | null;
  } | null>(null);

  useEffect(() => {
    if (!url) {
      queueMicrotask(() => setAsyncForSrc(null));
      return;
    }
    if (getBookImageIfReady(src)) {
      queueMicrotask(() => setAsyncForSrc(null));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setAsyncForSrc({ src, img: null }));
    void loadBookImage(src).then((im) => {
      if (!cancelled) {
        setAsyncForSrc((cur) => (cur?.src === src ? { src, img: im } : cur));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src, url]);

  if (cached) return cached;
  if (asyncForSrc?.src === src) return asyncForSrc.img;
  return null;
}

/** 위젯 팔레트 HTML5 DnD와 동일한 값 */
export const BOOK_WIDGET_DRAG_TYPE = "application/x-book-widget";

/** 미디어 라이브러리에서 슬라이드로 드래그할 때 사용 */
export const BOOK_LIBRARY_DRAG_TYPE = "application/x-book-library-media";

export type BookLibraryDragPayload = {
  kind: "image" | "video";
  src: string;
  posterSrc: string | null;
};

/** 이미지·동영상 위젯 우클릭 → 로컬 파일로 `src` 교체 요청 */
export type BookReplaceMediaFromFileRequest = {
  elementId: string;
  kind: "image" | "video";
};

export function parseLibraryDropPayload(
  e: DragEvent<HTMLElement>,
): BookLibraryDragPayload | null {
  try {
    const raw = e.dataTransfer.getData(BOOK_LIBRARY_DRAG_TYPE);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    if (r.kind !== "image" && r.kind !== "video") return null;
    if (typeof r.src !== "string" || r.src.length === 0) return null;
    const posterSrc =
      r.posterSrc === null || typeof r.posterSrc === "string" ? r.posterSrc : null;
    return { kind: r.kind, src: r.src, posterSrc };
  } catch {
    return null;
  }
}

/** 위젯 **중심**이 슬라이드 가로·세로 가운데에서 이 거리(논리 px) 안이면 기준선 표시 */
export const DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX = 10;

export type BookDropWidgetKind = "text" | "image" | "video" | "weather" | "digitalClock";

/** `id: null` = 선택 해제. `shiftKey` = 기존 선택에 토글 추가 */
export type BookCanvasSelectDetail = { id: string | null; shiftKey?: boolean };

type BookSlideCanvasProps = {
  pageWidth: number;
  pageHeight: number;
  /** 슬라이드 배경(CSS 색) */
  pageBackgroundColor: string;
  /** 논리 좌표(페이지 크기) 기준 표시 배율 */
  scale: number;
  elements: BookCanvasElement[];
  mode: "edit" | "view";
  selectedIds: readonly string[];
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  /** 편집 모드에서 팔레트 위젯을 캔버스로 드롭 */
  onDropWidget?: (point: { x: number; y: number }, kind: BookDropWidgetKind) => void;
  /** 편집 모드: 미디어 라이브러리에서 업로드된 URL을 슬라이드에 배치 */
  onDropLibraryMedia?: (
    point: { x: number; y: number },
    payload: BookLibraryDragPayload,
  ) => void;
  /** 편집 모드: 요소 배열 순서(앞=아래, 뒤=위) 조정 — 저장됨 */
  onReorderZ?: (elementId: string, op: ElementZOrderOp) => void;
  /** 편집 모드: 요소 우클릭 메뉴에서 삭제 */
  onDeleteElement?: (elementId: string) => void;
  /** 드래그 중 가운데 기준선이 뜨는 거리(논리 px). 미지정 시 `DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX` */
  centerGuideThresholdPx?: number;
  /** 드래그 스냅 그리드 간격(논리 px). 미지정 시 `BOOK_CANVAS_DRAG_GRID_PX` */
  dragGridPx?: number;
  /** `draw`: 슬라이드에서 자유 곡선(그 외는 선택·드래그) */
  editInteractionTool?: "default" | "draw";
  drawingStrokeColor?: string;
  drawingStrokeWidth?: number;
  /** 새 요소 추가(자유 그리기 확정 시) */
  onAppendElement?: (el: BookCanvasElement) => void;
  /** 이미지·동영상: 우클릭 → 탐색기로 파일 선택 후 업로드·교체 */
  onRequestReplaceMediaFromFile?: (req: BookReplaceMediaFromFileRequest) => void;
  /** 이미지·동영상: 우클릭 → 미디어 라이브러리에서 선택해 교체 */
  onRequestPickLibraryMediaForReplace?: (req: { elementId: string }) => void;
  /** `false`면 라이브러리 교체 메뉴 숨김(예: `/books/new`) */
  mediaLibraryReplaceEnabled?: boolean;
};

function clampSize(w: number, h: number, min = 24) {
  return { w: Math.max(min, w), h: Math.max(min, h) };
}

function BookFreehandDrawLayer({
  scale,
  pageWidth,
  pageHeight,
  strokeColor,
  strokeWidth,
  onCommit,
}: {
  scale: number;
  pageWidth: number;
  pageHeight: number;
  strokeColor: string;
  strokeWidth: number;
  onCommit: (pts: { x: number; y: number }[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<{ pointerId: number; pts: { x: number; y: number }[] } | null>(
    null,
  );
  const [preview, setPreview] = useState<{ x: number; y: number }[] | null>(null);

  const toLogical = (clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / scale;
    const y = (clientY - r.top) / scale;
    return {
      x: Math.max(0, Math.min(pageWidth, x)),
      y: Math.max(0, Math.min(pageHeight, y)),
    };
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[8] touch-none"
      style={{ cursor: "crosshair" }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const p0 = toLogical(e.clientX, e.clientY);
        activeRef.current = { pointerId: e.pointerId, pts: [p0] };
        setPreview([p0]);
      }}
      onPointerMove={(e) => {
        const a = activeRef.current;
        if (!a || e.pointerId !== a.pointerId) return;
        a.pts.push(toLogical(e.clientX, e.clientY));
        setPreview([...a.pts]);
      }}
      onPointerUp={(e) => {
        const a = activeRef.current;
        if (!a || e.pointerId !== a.pointerId) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        activeRef.current = null;
        setPreview(null);
        if (a.pts.length >= 2) onCommit(a.pts);
      }}
      onPointerCancel={(e) => {
        const a = activeRef.current;
        if (a && e.pointerId === a.pointerId) {
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          activeRef.current = null;
          setPreview(null);
        }
      }}
    >
      {preview && preview.length > 1 ? (
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={pageWidth * scale}
          height={pageHeight * scale}
          aria-hidden
        >
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={preview.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
          />
        </svg>
      ) : null}
    </div>
  );
}

/**
 * 변형 프리뷰 크기. 반드시 **현재 노드의 width/height × scale** 로 계산합니다.
 * (초기 `el.width`에 scale을 곱하면, 프레임마다 베이크된 뒤에도 같은 기준을 써서
 * 스케일이 이중 적용되어 조금만 움직여도 크기가 폭증합니다.)
 */
function transformLiveFrameSize(node: Konva.Node, sx: number, sy: number) {
  const w = node.width();
  const h = node.height();
  return {
    width: Math.max(1, Math.abs(w * sx)),
    height: Math.max(1, Math.abs(h * sy)),
  };
}

/** 드래그/변형 중 react-konva가 이전 props로 노드를 덮어쓰면(리렌더 시) 튀는 현상 방지 */
type BookDragLive = { id: string; cx: number; cy: number };
type BookTransformLive = {
  id: string;
  cx: number;
  cy: number;
  rotation: number;
  width: number;
  height: number;
};

type BookShapeLiveSync = {
  dragLive: BookDragLive | null;
  transformLive: BookTransformLive | null;
  /** 드래그 스냅·드래그 중 격자 오버레이에 쓰는 논리 px 간격 */
  dragGridPx: number;
  onDragLiveStart: (elementId: string, node: Konva.Node) => void;
  onDragLiveMove: (elementId: string, node: Konva.Node) => void;
  /** 드래그 중 논리 좌표 그리드 스냅 후 `dragLive` 갱신 */
  onDragMoveSnapGrid: (elementId: string, node: Konva.Node, logicalW: number, logicalH: number) => void;
  clearDragLive: () => void;
  /** 드래그 종료: 다중 선택 시 함께 이동, 아니면 해당 요소만 */
  commitDragEndPosition: (elementId: string, node: Konva.Node, logicalW: number, logicalH: number) => void;
  onTransformLiveStart: (elementId: string, node: Konva.Node) => void;
  onTransformLiveMove: (elementId: string, node: Konva.Node) => void;
  clearTransformLive: () => void;
};

/** HTML 오버레이(텍스트·비디오)를 Konva dragLive/transformLive와 동기화 */
function overlayLiveFrame(
  elementId: string,
  dragLive: BookDragLive | null,
  transformLive: BookTransformLive | null,
  frame: { w: number; h: number; rotation: number },
): BookTextOverlayLiveFrame | null {
  const tf = transformLive?.id === elementId ? transformLive : null;
  if (tf) {
    return {
      x: tf.cx - tf.width / 2,
      y: tf.cy - tf.height / 2,
      width: tf.width,
      height: tf.height,
      rotation: tf.rotation,
    };
  }
  const dg = dragLive?.id === elementId ? dragLive : null;
  if (dg) {
    return {
      x: dg.cx - frame.w / 2,
      y: dg.cy - frame.h / 2,
      width: frame.w,
      height: frame.h,
      rotation: frame.rotation,
    };
  }
  return null;
}

function formatMediaClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VIDEO_BAR_HIDE_DELAY_MS = 2000;

/** 슬라이드 위 HTML 비디오 + 하단 재생 컨트롤(호버 시 표시, 이탈 후 지연 숨김). */
function BookSlideVideoOverlay({
  el,
  scale,
  barVisible,
  liveFrame,
  onBarPointerEnter,
  onBarPointerLeave,
}: {
  el: Extract<BookCanvasElement, { type: "video" }>;
  scale: number;
  barVisible: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
  onBarPointerEnter: () => void;
  onBarPointerLeave: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [intrinsic, setIntrinsic] = useState<{ src: string; w: number; h: number } | null>(null);

  const src = publicAssetUrl(el.src) ?? el.src;
  const poster =
    el.posterSrc != null ? (publicAssetUrl(el.posterSrc) ?? el.posterSrc) : undefined;

  const syncFromVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setPlaying(!v.paused);
    setCurrentTime(v.currentTime);
    setDuration(Number.isFinite(v.duration) ? v.duration : 0);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => syncFromVideo();
    const onPause = () => syncFromVideo();
    const onTime = () => syncFromVideo();
    const onMeta = () => syncFromVideo();
    const onEnded = () => syncFromVideo();
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnded);
    syncFromVideo();
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnded);
    };
  }, [src, syncFromVideo]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  const stop = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setPlaying(false);
    setCurrentTime(0);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const vOpacity = resolveBookElementOpacity(el.opacity);
  const vRot = resolveBookElementRotation(el.rotation);
  const vPivot = bookElementPivotKonva(el);
  const vOrigin = bookElementOverlayTopLeftFromPivot(vPivot, el.width, el.height);
  const vx = liveFrame?.x ?? vOrigin.x;
  const vy = liveFrame?.y ?? vOrigin.y;
  const vw = liveFrame?.width ?? el.width;
  const vh = liveFrame?.height ?? el.height;
  const vDeg = liveFrame != null ? liveFrame.rotation : vRot;

  const fit = resolveBookMediaObjectFit(el.objectFit);
  const layout =
    intrinsic && intrinsic.src === src && intrinsic.w > 0 && intrinsic.h > 0
      ? computeKonvaFittedImageLayout(el.objectFit, vw, vh, intrinsic.w, intrinsic.h)
      : null;
  /** cover·fill은 브라우저 object-*로 처리. contain·scale-down·none은 박스만큼만 비디오를 두어 레터박스 검정을 피함 */
  const fullBleedFit = fit === "cover" || fit === "fill";
  const useLayoutBox = Boolean(layout && !fullBleedFit);

  const vidBr = resolveBookElementBorderRadius(el);
  const vidOw = resolveBookElementOutlineWidth(el);
  const vidOc = resolveBookElementOutlineColor(el);
  const vidOutlineShadow =
    vidOw > 0 ? `0 0 0 ${Math.max(0.5, vidOw * scale)}px ${vidOc}` : undefined;

  const boxStyle = {
    left: vx * scale,
    top: vy * scale,
    width: vw * scale,
    height: vh * scale,
    opacity: vOpacity,
    transform: vDeg !== 0 ? `rotate(${vDeg}deg)` : undefined,
    transformOrigin: "center center" as const,
    borderRadius: Math.max(0, vidBr * scale),
  };

  return (
    <>
      {/* Konva(z-1) 아래: 화면 + 외곽선 — 선택/트랜스포머가 위에 보이게 */}
      <div
        className="absolute z-0 overflow-hidden pointer-events-none"
        style={{
          ...boxStyle,
          boxShadow: vidOutlineShadow,
        }}
      >
        <video
          ref={videoRef}
          className={cn(
            "pointer-events-none absolute outline-none",
            useLayoutBox ? undefined : "inset-0 size-full",
            !useLayoutBox && mediaObjectFitToCssClass(el.objectFit),
          )}
          style={
            useLayoutBox && layout
              ? {
                  left: layout.x * scale,
                  top: layout.y * scale,
                  width: layout.width * scale,
                  height: layout.height * scale,
                  objectFit: "fill",
                  backgroundColor: "transparent",
                }
              : { backgroundColor: "transparent" }
          }
          src={src}
          poster={poster || undefined}
          muted
          playsInline
          preload="metadata"
          controls={false}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            const w = v.videoWidth;
            const h = v.videoHeight;
            if (w > 0 && h > 0) setIntrinsic({ src, w, h });
          }}
        />
      </div>
      {/* Konva보다 위: 하단 바만 클릭 가능. 나머지 영역은 pointer-events-none으로 Konva로 통과 */}
      <div className="absolute z-2 overflow-hidden pointer-events-none" style={boxStyle}>
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 z-10 flex h-9 min-h-9 items-center gap-1 border-t border-white/15 bg-black/75 px-1 py-0.5 transition-opacity duration-200",
            barVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onPointerEnter={onBarPointerEnter}
          onPointerLeave={onBarPointerLeave}
        >
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15"
            onClick={togglePlay}
            aria-label={playing ? "일시정지" : "재생"}
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 pl-0.5" />}
          </button>
          <button
            type="button"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/15"
            onClick={stop}
            aria-label="정지"
          >
            <Square className="size-3 fill-current" />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            disabled={duration <= 0}
            onChange={(e) => {
              const v = videoRef.current;
              if (!v || duration <= 0) return;
              v.currentTime = Number(e.target.value) * duration;
              syncFromVideo();
            }}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-primary disabled:opacity-40"
            aria-label="재생 위치"
          />
          <span className="shrink-0 text-[10px] tabular-nums leading-none text-white/90">
            {formatMediaClock(currentTime)} / {formatMediaClock(duration)}
          </span>
        </div>
      </div>
    </>
  );
}

export function BookSlideCanvas({
  pageWidth,
  pageHeight,
  pageBackgroundColor,
  scale,
  elements,
  mode,
  selectedIds,
  onSelect,
  onElementChange,
  onDropWidget,
  onDropLibraryMedia,
  onReorderZ,
  onDeleteElement,
  centerGuideThresholdPx = DEFAULT_BOOK_SLIDE_CENTER_GUIDE_THRESHOLD_PX,
  dragGridPx = BOOK_CANVAS_DRAG_GRID_PX,
  editInteractionTool = "default",
  drawingStrokeColor = "#0f172a",
  drawingStrokeWidth = 4,
  onAppendElement,
  onRequestReplaceMediaFromFile,
  onRequestPickLibraryMediaForReplace,
  mediaLibraryReplaceEnabled = false,
}: BookSlideCanvasProps) {
  const trRef = useRef<Konva.Transformer>(null);
  const konvaNodeByIdRef = useRef<Map<string, Konva.Node>>(new Map());
  const groupDragSnapRef = useRef<{
    leaderId: string;
    origins: Map<string, { x: number; y: number }>;
  } | null>(null);
  const videoBarHideTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [videoBarVisible, setVideoBarVisible] = useState<Record<string, boolean>>({});
  const [zMenu, setZMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const zMenuRef = useRef<HTMLDivElement>(null);
  /** 편집 모드에서 우클릭: 순서·삭제·슬라이드 전체 맞춤 등 */
  const elementContextMenuEnabled = mode === "edit";

  const visibleElements = useMemo(
    () => elements.filter(isBookElementVisible),
    [elements],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const registerKonvaNode = useCallback((elementId: string, node: Konva.Node | null) => {
    const m = konvaNodeByIdRef.current;
    if (node) m.set(elementId, node);
    else m.delete(elementId);
  }, []);

  const [dragLive, setDragLive] = useState<BookDragLive | null>(null);
  const [transformLive, setTransformLive] = useState<BookTransformLive | null>(null);
  const dragLiveRafRef = useRef<number | null>(null);
  const transformLiveRafRef = useRef<number | null>(null);
  const transformLivePendingRef = useRef<{ id: string; node: Konva.Node } | null>(null);

  const clearDragLive = useCallback(() => {
    if (dragLiveRafRef.current != null) {
      cancelAnimationFrame(dragLiveRafRef.current);
      dragLiveRafRef.current = null;
    }
    setDragLive(null);
  }, []);

  const clearTransformLive = useCallback(() => {
    if (transformLiveRafRef.current != null) {
      cancelAnimationFrame(transformLiveRafRef.current);
      transformLiveRafRef.current = null;
    }
    transformLivePendingRef.current = null;
    setTransformLive(null);
  }, []);

  const onDragLiveStartBase = useCallback((elementId: string, node: Konva.Node) => {
    if (dragLiveRafRef.current != null) {
      cancelAnimationFrame(dragLiveRafRef.current);
      dragLiveRafRef.current = null;
    }
    clearTransformLive();
    setDragLive({ id: elementId, cx: node.x(), cy: node.y() });
  }, [clearTransformLive]);

  const onDragLiveStart = useCallback(
    (elementId: string, node: Konva.Node) => {
      onDragLiveStartBase(elementId, node);
      const movable = selectedIds.filter((id) => {
        const e = elements.find((x) => x.id === id);
        return e && isBookElementVisible(e) && !isBookElementLocked(e);
      });
      if (movable.length > 1 && movable.includes(elementId)) {
        const origins = new Map<string, { x: number; y: number }>();
        for (const id of movable) {
          const e = elements.find((x) => x.id === id);
          if (e) origins.set(id, { x: e.x, y: e.y });
        }
        groupDragSnapRef.current = { leaderId: elementId, origins };
      } else {
        groupDragSnapRef.current = null;
      }
    },
    [elements, onDragLiveStartBase, selectedIds],
  );

  const onDragLiveMove = useCallback((elementId: string, node: Konva.Node) => {
    if (dragLiveRafRef.current != null) cancelAnimationFrame(dragLiveRafRef.current);
    dragLiveRafRef.current = requestAnimationFrame(() => {
      dragLiveRafRef.current = null;
      setDragLive({ id: elementId, cx: node.x(), cy: node.y() });
    });
  }, []);

  const onTransformLiveStart = useCallback((elementId: string, node: Konva.Node) => {
    if (dragLiveRafRef.current != null) {
      cancelAnimationFrame(dragLiveRafRef.current);
      dragLiveRafRef.current = null;
    }
    setDragLive(null);
    if (transformLiveRafRef.current != null) {
      cancelAnimationFrame(transformLiveRafRef.current);
      transformLiveRafRef.current = null;
    }
    transformLivePendingRef.current = null;
    const sx = node.scaleX();
    const sy = node.scaleY();
    const { width, height } = transformLiveFrameSize(node, sx, sy);
    setTransformLive({
      id: elementId,
      cx: node.x(),
      cy: node.y(),
      rotation: node.rotation(),
      width,
      height,
    });
  }, []);

  const onTransformLiveMove = useCallback((elementId: string, node: Konva.Node) => {
    transformLivePendingRef.current = { id: elementId, node };
    if (transformLiveRafRef.current != null) return;
    transformLiveRafRef.current = requestAnimationFrame(() => {
      transformLiveRafRef.current = null;
      const pending = transformLivePendingRef.current;
      if (!pending) return;
      const n = pending.node;
      const sx = n.scaleX();
      const sy = n.scaleY();
      const { width, height } = transformLiveFrameSize(n, sx, sy);
      setTransformLive({
        id: pending.id,
        cx: n.x(),
        cy: n.y(),
        rotation: n.rotation(),
        width,
        height,
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      if (dragLiveRafRef.current != null) cancelAnimationFrame(dragLiveRafRef.current);
      if (transformLiveRafRef.current != null) cancelAnimationFrame(transformLiveRafRef.current);
    };
  }, []);

  const commitDragEndPosition = useCallback(
    (elementId: string, node: Konva.Node, logicalW: number, logicalH: number) => {
      snapKonvaBookNodePositionToGrid(
        node,
        {
          width: logicalW,
          height: logicalH,
          rotation: node.rotation(),
        },
        dragGridPx,
      );
      const tl = konvaBookTopLeftFromNode(node);
      const g = groupDragSnapRef.current;
      if (g && g.leaderId === elementId && g.origins.size > 1) {
        const o0 = g.origins.get(elementId);
        if (o0) {
          const dx = tl.x - o0.x;
          const dy = tl.y - o0.y;
          for (const [id, pos] of g.origins) {
            if (id === elementId) {
              onElementChange(id, { x: tl.x, y: tl.y });
            } else {
              onElementChange(id, { x: pos.x + dx, y: pos.y + dy });
            }
          }
        }
        groupDragSnapRef.current = null;
      } else {
        onElementChange(elementId, { x: tl.x, y: tl.y });
        groupDragSnapRef.current = null;
      }
      clearDragLive();
    },
    [clearDragLive, dragGridPx, onElementChange],
  );

  const shapeLiveSync: BookShapeLiveSync = useMemo(
    () => ({
      dragLive,
      transformLive,
      dragGridPx,
      onDragLiveStart,
      onDragLiveMove,
      onDragMoveSnapGrid: (elementId, node, logicalW, logicalH) => {
        snapKonvaBookNodePositionToGrid(
          node,
          {
            width: logicalW,
            height: logicalH,
            rotation: node.rotation(),
          },
          dragGridPx,
        );
        onDragLiveMove(elementId, node);
      },
      clearDragLive,
      commitDragEndPosition,
      onTransformLiveStart,
      onTransformLiveMove,
      clearTransformLive,
    }),
    [
      dragLive,
      transformLive,
      dragGridPx,
      onDragLiveStart,
      onDragLiveMove,
      clearDragLive,
      commitDragEndPosition,
      onTransformLiveStart,
      onTransformLiveMove,
      clearTransformLive,
    ],
  );

  const showVideoBar = useCallback((id: string) => {
    const t = videoBarHideTimers.current.get(id);
    if (t) clearTimeout(t);
    videoBarHideTimers.current.delete(id);
    setVideoBarVisible((m) => (m[id] ? m : { ...m, [id]: true }));
  }, []);

  const scheduleHideVideoBar = useCallback((id: string) => {
    const prev = videoBarHideTimers.current.get(id);
    if (prev) clearTimeout(prev);
    videoBarHideTimers.current.set(
      id,
      setTimeout(() => {
        videoBarHideTimers.current.delete(id);
        setVideoBarVisible((m) => {
          if (!m[id]) return m;
          return { ...m, [id]: false };
        });
      }, VIDEO_BAR_HIDE_DELAY_MS),
    );
  }, []);

  useEffect(() => {
    const timers = videoBarHideTimers.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const textHeightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const m = textHeightTimers.current;
    return () => {
      m.forEach(clearTimeout);
      m.clear();
    };
  }, []);

  const scheduleTextBoxHeight = useCallback(
    (elementId: string, nextHeight: number) => {
      const t = textHeightTimers.current.get(elementId);
      if (t) clearTimeout(t);
      textHeightTimers.current.set(
        elementId,
        setTimeout(() => {
          textHeightTimers.current.delete(elementId);
          onElementChange(elementId, { height: nextHeight });
        }, 120),
      );
    },
    [onElementChange],
  );

  useEffect(() => {
    if (!zMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZMenu(null);
    };
    const onPointerDownCapture = (e: PointerEvent) => {
      if (zMenuRef.current?.contains(e.target as Node)) return;
      setZMenu(null);
    };
    const raf = window.requestAnimationFrame(() => {
      window.addEventListener("pointerdown", onPointerDownCapture, true);
    });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [zMenu]);

  useEffect(() => {
    if (mode !== "edit" || selectedIds.length === 0 || zMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight"
      ) {
        return;
      }
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("input, textarea, [contenteditable=true]")) return;
      if (
        t.closest(
          '[data-slot="select-content"], [data-slot="combobox-content"], [data-slot="combobox-list"]',
        )
      ) {
        return;
      }
      const movers = selectedIds
        .map((id) => elements.find((x) => x.id === id))
        .filter(
          (el): el is BookCanvasElement =>
            el != null && !isBookElementLocked(el) && isBookElementVisible(el),
        );
      if (movers.length === 0) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else dy = step;
      for (const el of movers) {
        onElementChange(el.id, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, selectedIds, zMenu, elements, onElementChange]);

  const openZMenu = useCallback(
    (elementId: string, clientX: number, clientY: number) => {
      if (mode !== "edit") return;
      onSelect({ id: elementId });
      setZMenu({ x: clientX, y: clientY, elementId });
    },
    [mode, onSelect],
  );

  const applyFitToStage = useCallback(() => {
    if (!zMenu) return;
    onElementChange(zMenu.elementId, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
    setZMenu(null);
  }, [zMenu, onElementChange, pageWidth, pageHeight]);

  const applyDelete = useCallback(() => {
    if (!zMenu || !onDeleteElement) return;
    onDeleteElement(zMenu.elementId);
    setZMenu(null);
  }, [zMenu, onDeleteElement]);

  const applyZ = useCallback(
    (op: ElementZOrderOp) => {
      if (!zMenu || !onReorderZ) return;
      onReorderZ(zMenu.elementId, op);
      setZMenu(null);
    },
    [zMenu, onReorderZ],
  );

  const isLiveInteracting = dragLive !== null || transformLive !== null;

  useEffect(() => {
    const tr = trRef.current;
    const only =
      selectedIds.length === 1 && selectedIds[0] != null ? selectedIds[0] : null;
    const node = only ? konvaNodeByIdRef.current.get(only) : undefined;
    const sel = only ? elements.find((e) => e.id === only) : undefined;
    const selectedOnCanvas =
      Boolean(only) &&
      sel != null &&
      sel.type !== "drawing" &&
      isBookElementVisible(sel) &&
      !isBookElementLocked(sel) &&
      node != null;
    if (mode !== "edit" || !tr || !selectedOnCanvas) {
      tr?.nodes([]);
      tr?.getLayer()?.batchDraw();
      return;
    }
    /* 드래그·변형 중 tr.nodes 재호출 시 앵커/노드가 한 프레임 덮여 튐 */
    if (isLiveInteracting) return;
    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [mode, selectedIds, elements, visibleElements, pageWidth, pageHeight, isLiveInteracting]);

  const sw = pageWidth * scale;
  const sh = pageHeight * scale;

  const slideCenterGuides = useMemo(() => {
    if (mode !== "edit" || dragLive === null) return null;
    const midX = pageWidth / 2;
    const midY = pageHeight / 2;
    const th = centerGuideThresholdPx;
    const showV = Math.abs(dragLive.cx - midX) <= th;
    const showH = Math.abs(dragLive.cy - midY) <= th;
    if (!showV && !showH) return null;
    return {
      showV,
      showH,
      midXpx: midX * scale,
      midYpx: midY * scale,
    };
  }, [mode, dragLive, pageWidth, pageHeight, scale, centerGuideThresholdPx]);

  const dropEnabled =
    mode === "edit" &&
    editInteractionTool === "default" &&
    (Boolean(onDropWidget) || Boolean(onDropLibraryMedia));

  const parseDropKind = (e: DragEvent): BookDropWidgetKind | null => {
    const raw =
      e.dataTransfer.getData(BOOK_WIDGET_DRAG_TYPE) ||
      e.dataTransfer.getData("text/plain");
    if (
      raw === "text" ||
      raw === "image" ||
      raw === "video" ||
      raw === "weather" ||
      raw === "digitalClock"
    )
      return raw;
    return null;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!dropEnabled) return;
    const lib = onDropLibraryMedia ? parseLibraryDropPayload(e) : null;
    if (lib && onDropLibraryMedia) {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const lx = (e.clientX - rect.left) / scale;
      const ly = (e.clientY - rect.top) / scale;
      const x = Math.max(0, Math.min(lx, pageWidth - 24));
      const y = Math.max(0, Math.min(ly, pageHeight - 24));
      onDropLibraryMedia({ x, y }, lib);
      return;
    }
    if (!onDropWidget) return;
    e.preventDefault();
    const kind = parseDropKind(e);
    if (!kind) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const lx = (e.clientX - rect.left) / scale;
    const ly = (e.clientY - rect.top) / scale;
    const x = Math.max(0, Math.min(lx, pageWidth - 24));
    const y = Math.max(0, Math.min(ly, pageHeight - 24));
    onDropWidget({ x, y }, kind);
  };

  return (
    <div
      data-book-slide-root
      className={cn(
        "relative inline-block ring-1 ring-border shadow-sm",
        dropEnabled && "ring-primary/40",
        mode === "edit" && editInteractionTool === "draw" && "ring-2 ring-primary/45",
      )}
      onDragOver={
        dropEnabled
          ? (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
          : undefined
      }
      onDrop={dropEnabled ? handleDrop : undefined}
    >
      {/* 슬라이드 배경은 HTML — 비디오 화면은 z-0, 하단 컨트롤만 z-2로 Stage(z-1) 위에 올려 클릭이 Konva로만 가지 않게 함 */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundColor: pageBackgroundColor }}
        aria-hidden
      />
      {mode === "edit" && dragLive !== null ? (
        <div
          className="pointer-events-none absolute inset-0 z-[0.5]"
          style={{
            backgroundImage: `linear-gradient(to right, hsl(var(--foreground) / 0.07) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground) / 0.07) 1px, transparent 1px)`,
            backgroundSize: `${dragGridPx * scale}px ${dragGridPx * scale}px`,
          }}
          aria-hidden
        />
      ) : null}
      {slideCenterGuides ? (
        <div
          className="pointer-events-none absolute inset-0 z-[50]"
          aria-hidden
        >
          {slideCenterGuides.showV ? (
            <div
              className="absolute top-0 bottom-0 w-px bg-pink-500/90 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] dark:bg-fuchsia-400/85"
              style={{ left: slideCenterGuides.midXpx, marginLeft: -0.5 }}
            />
          ) : null}
          {slideCenterGuides.showH ? (
            <div
              className="absolute left-0 right-0 h-px bg-pink-500/90 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] dark:bg-fuchsia-400/85"
              style={{ top: slideCenterGuides.midYpx, marginTop: -0.5 }}
            />
          ) : null}
        </div>
      ) : null}
      {visibleElements
        .filter((e): e is Extract<BookCanvasElement, { type: "video" }> => e.type === "video")
        .map((el) => (
          <BookSlideVideoOverlay
            key={el.id}
            el={el}
            scale={scale}
            barVisible={Boolean(videoBarVisible[el.id])}
            liveFrame={overlayLiveFrame(el.id, dragLive, transformLive, {
              w: el.width,
              h: el.height,
              rotation: resolveBookElementRotation(el.rotation),
            })}
            onBarPointerEnter={() => showVideoBar(el.id)}
            onBarPointerLeave={() => scheduleHideVideoBar(el.id)}
          />
        ))}
      <div className="relative z-[1]">
        <Stage width={sw} height={sh} style={{ background: "transparent" }}>
        <Layer scaleX={scale} scaleY={scale}>
          <Rect
            width={pageWidth}
            height={pageHeight}
            fill="transparent"
            listening={mode === "edit"}
            onMouseDown={(e) => {
              if (mode !== "edit") return;
              e.cancelBubble = true;
              onSelect({ id: null });
            }}
          />
          {visibleElements.map((el) => {
            const isSelected = selectedIdSet.has(el.id);
            const locked = isBookElementLocked(el);
            if (el.type === "text") {
              return (
                <BookTextHitShape
                  key={el.id}
                  el={el}
                  locked={locked}
                  liveSync={shapeLiveSync}
                  registerKonvaNode={registerKonvaNode}
                  mode={mode}
                  onSelect={onSelect}
                  onElementChange={onElementChange}
                  zMenuEnabled={elementContextMenuEnabled && !locked}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            }
            if (el.type === "weather") {
              return (
                <BookWeatherHitShape
                  key={el.id}
                  el={el}
                  locked={locked}
                  liveSync={shapeLiveSync}
                  registerKonvaNode={registerKonvaNode}
                  mode={mode}
                  onSelect={onSelect}
                  onElementChange={onElementChange}
                  zMenuEnabled={elementContextMenuEnabled && !locked}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            }
            if (el.type === "digitalClock") {
              return (
                <BookDigitalClockHitShape
                  key={el.id}
                  el={el}
                  locked={locked}
                  liveSync={shapeLiveSync}
                  registerKonvaNode={registerKonvaNode}
                  mode={mode}
                  onSelect={onSelect}
                  onElementChange={onElementChange}
                  zMenuEnabled={elementContextMenuEnabled && !locked}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            }
            if (el.type === "image") {
              return (
                <BookImageShape
                  key={`${el.id}:${el.src}`}
                  el={el}
                  locked={locked}
                  liveSync={shapeLiveSync}
                  registerKonvaNode={registerKonvaNode}
                  mode={mode}
                  onSelect={onSelect}
                  onElementChange={onElementChange}
                  zMenuEnabled={elementContextMenuEnabled && !locked}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            }
            if (el.type === "drawing") {
              return (
                <BookDrawingHitShape
                  key={el.id}
                  el={el}
                  locked={locked}
                  liveSync={shapeLiveSync}
                  registerKonvaNode={registerKonvaNode}
                  mode={mode}
                  isSelected={isSelected}
                  onSelect={onSelect}
                  zMenuEnabled={elementContextMenuEnabled && !locked}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            }
            return (
              <BookVideoBox
                key={`${el.id}:${el.src}`}
                el={el}
                locked={locked}
                liveSync={shapeLiveSync}
                registerKonvaNode={registerKonvaNode}
                mode={mode}
                onSelect={onSelect}
                onElementChange={onElementChange}
                onVideoHoverEnter={() => showVideoBar(el.id)}
                onVideoHoverLeave={() => scheduleHideVideoBar(el.id)}
                zMenuEnabled={elementContextMenuEnabled && !locked}
                onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
              />
            );
          })}
          {mode === "edit" && selectedIds.length === 1 ? (
            <Transformer
              ref={trRef}
              rotateEnabled
              /** 기본 true면 비율 고정이라 한쪽 핸들만 잡아도 다른 축·반대쪽까지 같이 변하는 느낌이 남. Shift 누르면 비율 유지 */
              keepRatio={false}
              centeredScaling={false}
              borderStroke="#3b82f6"
              anchorFill="#fff"
              anchorStroke="#3b82f6"
              boundBoxFunc={(_oldBox, newBox) => {
                if (newBox.width < 24 || newBox.height < 24) return _oldBox;
                return newBox;
              }}
            />
          ) : null}
        </Layer>
        </Stage>
      </div>
      {mode === "edit" && editInteractionTool === "draw" && onAppendElement ? (
        <BookFreehandDrawLayer
          scale={scale}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          strokeColor={drawingStrokeColor}
          strokeWidth={drawingStrokeWidth}
          onCommit={(pts) => {
            const el = buildBookDrawingElement(pts, drawingStrokeColor, drawingStrokeWidth);
            if (el) onAppendElement(el);
          }}
        />
      ) : null}
      {mode === "edit" && elements.length === 0 && editInteractionTool !== "draw" ? (
        <div
          className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center px-4"
          aria-hidden
        >
          <p className="max-w-[min(100%,22rem)] text-center text-base font-medium tracking-tight text-muted-foreground/75">
            위젯을 끌어다 이 슬라이드에 놓으면 시작할 수 있어요.
          </p>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
        {visibleElements
          .filter(
            (e): e is Extract<BookCanvasElement, { type: "text" | "weather" | "digitalClock" }> =>
              e.type === "text" || e.type === "weather" || e.type === "digitalClock",
          )
          .map((el) => {
            if (el.type === "text") {
              const tw = el.width ?? 720;
              const th = textWidgetHitHeight(el);
              const textLive = overlayLiveFrame(el.id, dragLive, transformLive, {
                w: tw,
                h: th,
                rotation: resolveBookElementRotation(el.rotation),
              });
              return (
                <BookTextWidgetOverlay
                  key={el.id}
                  el={el}
                  scale={scale}
                  mode={mode}
                  isSelected={selectedIdSet.has(el.id)}
                  liveFrame={textLive}
                  onReportLogicalHeight={
                    mode === "edit"
                      ? (logical) => {
                          const next = Math.max(28, Math.min(4000, Math.ceil(logical)));
                          const prev =
                            typeof el.height === "number"
                              ? el.height
                              : defaultTextWidgetBoxHeight(el.fontSize);
                          if (Math.abs(next - prev) <= 2) return;
                          scheduleTextBoxHeight(el.id, next);
                        }
                      : undefined
                  }
                />
              );
            }
            const frameLive = overlayLiveFrame(el.id, dragLive, transformLive, {
              w: el.width,
              h: el.height,
              rotation: resolveBookElementRotation(el.rotation),
            });
            if (el.type === "weather") {
              return (
                <BookWeatherWidgetOverlay
                  key={el.id}
                  el={el}
                  scale={scale}
                  mode={mode}
                  isSelected={selectedIdSet.has(el.id)}
                  liveFrame={frameLive}
                />
              );
            }
            return (
              <BookDigitalClockWidgetOverlay
                key={el.id}
                el={el}
                scale={scale}
                mode={mode}
                isSelected={selectedIdSet.has(el.id)}
                liveFrame={frameLive}
              />
            );
          })}
      </div>
      {zMenu && mode === "edit"
        ? createPortal(
            <ContextMenuFloatingPanel
              ref={zMenuRef}
              className="z-[320] flex min-w-[11rem] flex-col gap-0.5"
              style={{
                position: "fixed",
                left: Math.min(
                  zMenu.x,
                  typeof window !== "undefined" ? Math.max(8, window.innerWidth - 200) : zMenu.x,
                ),
                top: Math.min(
                  zMenu.y,
                  typeof window !== "undefined" ? Math.max(8, window.innerHeight - 320) : zMenu.y,
                ),
              }}
            >
              <div className="flex flex-col gap-0.5" role="group" aria-label="크기">
                <ContextMenuFloatingItem onClick={() => applyFitToStage()}>
                  슬라이드 전체(0,0)로 맞추기
                </ContextMenuFloatingItem>
              </div>
              {(() => {
                const zTarget = elements.find((e) => e.id === zMenu.elementId);
                const mk =
                  zTarget?.type === "image"
                    ? ("image" as const)
                    : zTarget?.type === "video"
                      ? ("video" as const)
                      : null;
                const showFile = mk && onRequestReplaceMediaFromFile;
                const showLib =
                  mk && mediaLibraryReplaceEnabled && onRequestPickLibraryMediaForReplace;
                if (!showFile && !showLib) return null;
                return (
                  <>
                    <div
                      className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                      role="separator"
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-0.5" role="group" aria-label="미디어 교체">
                      {showFile ? (
                        <ContextMenuFloatingItem
                          onClick={() => {
                            onRequestReplaceMediaFromFile?.({
                              elementId: zMenu.elementId,
                              kind: mk,
                            });
                            setZMenu(null);
                          }}
                        >
                          <FolderOpen className="opacity-70" aria-hidden />
                          파일에서 바꾸기…
                        </ContextMenuFloatingItem>
                      ) : null}
                      {showLib ? (
                        <ContextMenuFloatingItem
                          onClick={() => {
                            onRequestPickLibraryMediaForReplace?.({
                              elementId: zMenu.elementId,
                            });
                            setZMenu(null);
                          }}
                        >
                          <Library className="opacity-70" aria-hidden />
                          미디어 라이브러리에서 바꾸기…
                        </ContextMenuFloatingItem>
                      ) : null}
                    </div>
                  </>
                );
              })()}
              {onReorderZ || onDeleteElement ? (
                <div
                  className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                  role="separator"
                  aria-hidden="true"
                />
              ) : null}
              {onReorderZ
                ? (() => {
                    const zi = elements.findIndex((e) => e.id === zMenu.elementId);
                    const n = elements.length;
                    return (
                      <div className="flex flex-col gap-0.5" role="group" aria-label="순서">
                        <ContextMenuFloatingItem
                          disabled={zi < 0 || zi >= n - 1}
                          onClick={() => applyZ("forward")}
                        >
                          한 칸 앞으로
                        </ContextMenuFloatingItem>
                        <ContextMenuFloatingItem
                          disabled={zi <= 0}
                          onClick={() => applyZ("backward")}
                        >
                          한 칸 뒤로
                        </ContextMenuFloatingItem>
                        <ContextMenuFloatingItem
                          disabled={zi < 0 || zi >= n - 1}
                          onClick={() => applyZ("front")}
                        >
                          맨 앞으로
                        </ContextMenuFloatingItem>
                        <ContextMenuFloatingItem
                          disabled={zi <= 0}
                          onClick={() => applyZ("back")}
                        >
                          맨 뒤로
                        </ContextMenuFloatingItem>
                      </div>
                    );
                  })()
                : null}
              {onReorderZ && onDeleteElement ? (
                <div
                  className="-mx-1 my-0.5 h-px shrink-0 bg-border"
                  role="separator"
                  aria-hidden="true"
                />
              ) : null}
              {onDeleteElement ? (
                <div className="flex flex-col gap-0.5" role="group" aria-label="편집">
                  <ContextMenuFloatingItem variant="destructive" onClick={() => applyDelete()}>
                    위젯 지우기
                  </ContextMenuFloatingItem>
                </div>
              ) : null}
            </ContextMenuFloatingPanel>,
            document.body,
          )
        : null}
    </div>
  );
}

function BookDrawingHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  isSelected,
  onSelect,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "drawing" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  isSelected: boolean;
  onSelect: (detail: BookCanvasSelectDetail) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width;
  const h = el.height;
  const dOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva(el);
  const tf = liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let pivot = basePivot;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    pivot = {
      cx: tf.cx,
      cy: tf.cy,
      offsetX: fw / 2,
      offsetY: fh / 2,
      rotation: tf.rotation,
    };
  } else if (dg) {
    pivot = { ...basePivot, cx: dg.cx, cy: dg.cy };
  }

  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={pivot.cx}
      y={pivot.cy}
      offsetX={pivot.offsetX}
      offsetY={pivot.offsetY}
      rotation={pivot.rotation}
      opacity={dOpacity}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked ? undefined : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
    >
      <Rect
        width={fw}
        height={fh}
        fill="rgba(0,0,0,0.001)"
        stroke={isSelected && mode === "edit" ? "#3b82f6" : "transparent"}
        strokeWidth={2}
      />
      <Line
        points={el.points}
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    </Group>
  );
}

/** 리치 텍스트는 HTML 오버레이로 그리고, Konva Rect는 조작·히트만 담당합니다. */
function BookTextHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "text" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width ?? 720;
  const h = textWidgetHitHeight(el);
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({ x: el.x, y: el.y, width: w, height: h, rotation: el.rotation });
  const tf = liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let pivot = basePivot;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    pivot = {
      cx: tf.cx,
      cy: tf.cy,
      offsetX: fw / 2,
      offsetY: fh / 2,
      rotation: tf.rotation,
    };
  } else if (dg) {
    pivot = { ...basePivot, cx: dg.cx, cy: dg.cy };
  }
  const tBr = resolveBookElementBorderRadius(el);
  const tOw = resolveBookElementOutlineWidth(el);
  const tOc = resolveBookElementOutlineColor(el);
  return (
    <Rect
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={pivot.cx}
      y={pivot.cy}
      offsetX={pivot.offsetX}
      offsetY={pivot.offsetY}
      width={fw}
      height={fh}
      rotation={pivot.rotation}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      fill="transparent"
      cornerRadius={tBr}
      stroke={tOw > 0 ? tOc : "transparent"}
      strokeWidth={tOw > 0 ? tOw : 0}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked
          ? undefined
          : (e) => {
              liveSync.onDragLiveStart(el.id, e.target);
            }
      }
      onDragMove={
        locked
          ? undefined
          : (e) => {
              liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh);
            }
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked ? undefined : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={locked ? undefined : (e) => liveSync.onTransformLiveMove(el.id, e.target)}
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.clearTransformLive();
              const node = e.target;
              const sx = Math.abs(node.scaleX());
              const sy = Math.abs(node.scaleY());
              node.scaleX(1);
              node.scaleY(1);
              const nw = Math.max(24, node.width() * sx);
              const nh = Math.max(28, node.height() * sy);
              node.width(nw);
              node.height(nh);
              node.offsetX(nw / 2);
              node.offsetY(nh / 2);
              const tl = konvaBookTopLeftFromNode(node);
              onElementChange(el.id, {
                x: tl.x,
                y: tl.y,
                width: nw,
                height: nh,
                rotation: node.rotation(),
              });
            }
      }
    />
  );
}

const WEATHER_WIDGET_MIN_W = 160;
const WEATHER_WIDGET_MIN_H = 100;

const DIGITAL_CLOCK_MIN_W = 120;
const DIGITAL_CLOCK_MIN_H = 52;

function BookDigitalClockHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "digitalClock" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width;
  const h = el.height;
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({ x: el.x, y: el.y, width: w, height: h, rotation: el.rotation });
  const tf = liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let pivot = basePivot;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    pivot = {
      cx: tf.cx,
      cy: tf.cy,
      offsetX: fw / 2,
      offsetY: fh / 2,
      rotation: tf.rotation,
    };
  } else if (dg) {
    pivot = { ...basePivot, cx: dg.cx, cy: dg.cy };
  }
  const dcBr = resolveBookElementBorderRadius(el);
  const dcOw = resolveBookElementOutlineWidth(el);
  const dcOc = resolveBookElementOutlineColor(el);
  return (
    <Rect
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={pivot.cx}
      y={pivot.cy}
      offsetX={pivot.offsetX}
      offsetY={pivot.offsetY}
      width={fw}
      height={fh}
      rotation={pivot.rotation}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      fill="transparent"
      cornerRadius={dcBr}
      stroke={dcOw > 0 ? dcOc : "transparent"}
      strokeWidth={dcOw > 0 ? dcOw : 0}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked ? undefined : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked ? undefined : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked ? undefined : (e) => liveSync.onTransformLiveMove(el.id, e.target)
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.clearTransformLive();
              const node = e.target;
              const sx = Math.abs(node.scaleX());
              const sy = Math.abs(node.scaleY());
              node.scaleX(1);
              node.scaleY(1);
              const nw = Math.max(DIGITAL_CLOCK_MIN_W, node.width() * sx);
              const nh = Math.max(DIGITAL_CLOCK_MIN_H, node.height() * sy);
              node.width(nw);
              node.height(nh);
              node.offsetX(nw / 2);
              node.offsetY(nh / 2);
              const tl = konvaBookTopLeftFromNode(node);
              onElementChange(el.id, {
                x: tl.x,
                y: tl.y,
                width: nw,
                height: nh,
                rotation: node.rotation(),
              });
            }
      }
    />
  );
}

function BookWeatherHitShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "weather" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width;
  const h = el.height;
  const tOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva({ x: el.x, y: el.y, width: w, height: h, rotation: el.rotation });
  const tf = liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  let fw = w;
  let fh = h;
  let pivot = basePivot;
  if (tf) {
    fw = tf.width;
    fh = tf.height;
    pivot = {
      cx: tf.cx,
      cy: tf.cy,
      offsetX: fw / 2,
      offsetY: fh / 2,
      rotation: tf.rotation,
    };
  } else if (dg) {
    pivot = { ...basePivot, cx: dg.cx, cy: dg.cy };
  }
  const wBr = resolveBookElementBorderRadius(el);
  const wOw = resolveBookElementOutlineWidth(el);
  const wOc = resolveBookElementOutlineColor(el);
  return (
    <Rect
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={pivot.cx}
      y={pivot.cy}
      offsetX={pivot.offsetX}
      offsetY={pivot.offsetY}
      width={fw}
      height={fh}
      rotation={pivot.rotation}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={tOpacity}
      fill="transparent"
      cornerRadius={wBr}
      stroke={wOw > 0 ? wOc : "transparent"}
      strokeWidth={wOw > 0 ? wOw : 0}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked ? undefined : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked ? undefined : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked ? undefined : (e) => liveSync.onTransformLiveMove(el.id, e.target)
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.clearTransformLive();
              const node = e.target;
              const sx = Math.abs(node.scaleX());
              const sy = Math.abs(node.scaleY());
              node.scaleX(1);
              node.scaleY(1);
              const nw = Math.max(WEATHER_WIDGET_MIN_W, node.width() * sx);
              const nh = Math.max(WEATHER_WIDGET_MIN_H, node.height() * sy);
              node.width(nw);
              node.height(nh);
              node.offsetX(nw / 2);
              node.offsetY(nh / 2);
              const tl = konvaBookTopLeftFromNode(node);
              onElementChange(el.id, {
                x: tl.x,
                y: tl.y,
                width: nw,
                height: nh,
                rotation: node.rotation(),
              });
            }
      }
    />
  );
}

function BookImageShape({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "image" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const img = useBookImage(el.src);
  const basePivot = bookElementPivotKonva(el);
  const tf = liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  const fw = tf ? tf.width : el.width;
  const fh = tf ? tf.height : el.height;
  let pivot = basePivot;
  if (tf) {
    pivot = {
      cx: tf.cx,
      cy: tf.cy,
      offsetX: fw / 2,
      offsetY: fh / 2,
      rotation: tf.rotation,
    };
  } else if (dg) {
    pivot = { ...basePivot, cx: dg.cx, cy: dg.cy };
  }
  const layout = useMemo(
    () =>
      img
        ? computeKonvaFittedImageLayout(el.objectFit, fw, fh, img.naturalWidth, img.naturalHeight)
        : null,
    [img, el.objectFit, fw, fh],
  );
  const imgOpacity = resolveBookElementOpacity(el.opacity);
  const imgBr = resolveBookElementBorderRadius(el);
  const imgOw = resolveBookElementOutlineWidth(el);
  const imgOc = resolveBookElementOutlineColor(el);

  return (
    <Group
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={pivot.cx}
      y={pivot.cy}
      offsetX={pivot.offsetX}
      offsetY={pivot.offsetY}
      rotation={pivot.rotation}
      width={fw}
      height={fh}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={imgOpacity}
      clipFunc={(ctx) => {
        canvasRoundRectPath(ctx as never, 0, 0, fw, fh, imgBr);
      }}
      draggable={mode === "edit" && !locked}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked ? undefined : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target as Konva.Node, fw, fh);
            }
      }
      onTransformStart={
        locked ? undefined : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked ? undefined : (e) => liveSync.onTransformLiveMove(el.id, e.target)
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.clearTransformLive();
              const node = e.target as Konva.Group;
              const sx = Math.abs(node.scaleX());
              const sy = Math.abs(node.scaleY());
              node.scaleX(1);
              node.scaleY(1);
              const { w: nw, h: nh } = clampSize(node.width() * sx, node.height() * sy);
              node.width(nw);
              node.height(nh);
              node.offsetX(nw / 2);
              node.offsetY(nh / 2);
              const tl = konvaBookTopLeftFromNode(node);
              onElementChange(el.id, {
                x: tl.x,
                y: tl.y,
                width: nw,
                height: nh,
                rotation: node.rotation(),
              });
            }
      }
    >
      {img && layout ? (
        <KonvaImage
          image={img}
          x={layout.x}
          y={layout.y}
          width={layout.width}
          height={layout.height}
          {...(layout.crop ? { crop: layout.crop } : {})}
          listening={false}
        />
      ) : (
        <Rect
          x={0}
          y={0}
          width={fw}
          height={fh}
          cornerRadius={imgBr}
          fill="#e5e7eb"
          stroke="#94a3b8"
          strokeWidth={1}
          listening={false}
        />
      )}
      {imgOw > 0 ? (
        <Rect
          x={0}
          y={0}
          width={fw}
          height={fh}
          cornerRadius={imgBr}
          fillEnabled={false}
          stroke={imgOc}
          strokeWidth={imgOw}
          listening={false}
        />
      ) : null}
      <Rect
        x={0}
        y={0}
        width={fw}
        height={fh}
        cornerRadius={imgBr}
        fill="rgba(0,0,0,0.01)"
        listening
      />
    </Group>
  );
}

function BookVideoBox({
  el,
  locked,
  liveSync,
  registerKonvaNode,
  mode,
  onSelect,
  onElementChange,
  onVideoHoverEnter,
  onVideoHoverLeave,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "video" }>;
  locked: boolean;
  liveSync: BookShapeLiveSync;
  registerKonvaNode: (elementId: string, node: Konva.Node | null) => void;
  mode: "edit" | "view";
  onSelect: (detail: BookCanvasSelectDetail) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  onVideoHoverEnter: () => void;
  onVideoHoverLeave: () => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const vidOpacity = resolveBookElementOpacity(el.opacity);
  const basePivot = bookElementPivotKonva(el);
  const tf = liveSync.transformLive?.id === el.id ? liveSync.transformLive : null;
  const dg = liveSync.dragLive?.id === el.id ? liveSync.dragLive : null;
  const fw = tf ? tf.width : el.width;
  const fh = tf ? tf.height : el.height;
  let pivot = basePivot;
  if (tf) {
    pivot = {
      cx: tf.cx,
      cy: tf.cy,
      offsetX: fw / 2,
      offsetY: fh / 2,
      rotation: tf.rotation,
    };
  } else if (dg) {
    pivot = { ...basePivot, cx: dg.cx, cy: dg.cy };
  }
  const vBr = resolveBookElementBorderRadius(el);
  const vOw = resolveBookElementOutlineWidth(el);
  const vOc = resolveBookElementOutlineColor(el);
  const videoEditGuide = mode === "edit" && vOw <= 0;
  return (
    <Rect
      ref={(node) => {
        registerKonvaNode(el.id, node);
      }}
      x={pivot.cx}
      y={pivot.cy}
      offsetX={pivot.offsetX}
      offsetY={pivot.offsetY}
      width={fw}
      height={fh}
      rotation={pivot.rotation}
      scaleX={tf ? 1 : undefined}
      scaleY={tf ? 1 : undefined}
      opacity={vidOpacity}
      fill="transparent"
      cornerRadius={vBr}
      stroke={vOw > 0 ? vOc : videoEditGuide ? "#cbd5e1" : "transparent"}
      strokeWidth={vOw > 0 ? vOw : videoEditGuide ? 1 : 0}
      draggable={mode === "edit" && !locked}
      onMouseEnter={onVideoHoverEnter}
      onMouseLeave={onVideoHoverLeave}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect({ id: el.id, shiftKey: e.evt.shiftKey });
      }}
      onContextMenu={
        zMenuEnabled
          ? (e) => {
              e.cancelBubble = true;
              e.evt.preventDefault();
              onZMenu(e.evt.clientX, e.evt.clientY);
            }
          : undefined
      }
      onDragStart={
        locked ? undefined : (e) => liveSync.onDragLiveStart(el.id, e.target)
      }
      onDragMove={
        locked ? undefined : (e) => liveSync.onDragMoveSnapGrid(el.id, e.target, fw, fh)
      }
      onDragEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.commitDragEndPosition(el.id, e.target, fw, fh);
            }
      }
      onTransformStart={
        locked ? undefined : (e) => liveSync.onTransformLiveStart(el.id, e.target)
      }
      onTransform={
        locked ? undefined : (e) => liveSync.onTransformLiveMove(el.id, e.target)
      }
      onTransformEnd={
        locked
          ? undefined
          : (e) => {
              liveSync.clearTransformLive();
              const node = e.target;
              const sx = Math.abs(node.scaleX());
              const sy = Math.abs(node.scaleY());
              node.scaleX(1);
              node.scaleY(1);
              const { w: nw, h: nh } = clampSize(node.width() * sx, node.height() * sy);
              node.width(nw);
              node.height(nh);
              node.offsetX(nw / 2);
              node.offsetY(nh / 2);
              const tl = konvaBookTopLeftFromNode(node);
              onElementChange(el.id, {
                x: tl.x,
                y: tl.y,
                width: nw,
                height: nh,
                rotation: node.rotation(),
              });
            }
      }
    />
  );
}

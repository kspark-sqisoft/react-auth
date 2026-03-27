import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MutableRefObject,
} from "react";
import { createPortal } from "react-dom";
import { Image as KonvaImage, Layer, Rect, Stage, Transformer } from "react-konva";
import type Konva from "konva";
import { Pause, Play, Square } from "lucide-react";
import {
  ContextMenuFloatingItem,
  ContextMenuFloatingPanel,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { BookCanvasElement, ElementZOrderOp } from "@/lib/book-canvas";
import { publicAssetUrl } from "@/lib/api";
import { BookTextWidgetOverlay } from "@/components/books/BookTextWidgetOverlay";
import { defaultTextWidgetBoxHeight, textWidgetHitHeight } from "@/lib/book-text-widget";

function useBookImage(src: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const u = publicAssetUrl(src) ?? src;
    if (!u) {
      queueMicrotask(() => setImg(null));
      return;
    }
    const im = new window.Image();
    im.crossOrigin = "anonymous";
    im.onload = () => setImg(im);
    im.onerror = () => setImg(null);
    im.src = u;
    return () => {
      im.onload = null;
      im.onerror = null;
    };
  }, [src]);
  return img;
}

/** 위젯 팔레트 HTML5 DnD와 동일한 값 */
export const BOOK_WIDGET_DRAG_TYPE = "application/x-book-widget";

export type BookDropWidgetKind = "text" | "image" | "video";

type BookSlideCanvasProps = {
  pageWidth: number;
  pageHeight: number;
  /** 슬라이드 배경(CSS 색) */
  pageBackgroundColor: string;
  /** 논리 좌표(페이지 크기) 기준 표시 배율 */
  scale: number;
  elements: BookCanvasElement[];
  mode: "edit" | "view";
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  /** 편집 모드에서 팔레트 위젯을 캔버스로 드롭 */
  onDropWidget?: (point: { x: number; y: number }, kind: BookDropWidgetKind) => void;
  /** 편집 모드: 요소 배열 순서(앞=아래, 뒤=위) 조정 — 저장됨 */
  onReorderZ?: (elementId: string, op: ElementZOrderOp) => void;
  /** 편집 모드: 요소 우클릭 메뉴에서 삭제 */
  onDeleteElement?: (elementId: string) => void;
};

function clampSize(w: number, h: number, min = 24) {
  return { w: Math.max(min, w), h: Math.max(min, h) };
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
  onBarPointerEnter,
  onBarPointerLeave,
}: {
  el: Extract<BookCanvasElement, { type: "video" }>;
  scale: number;
  barVisible: boolean;
  onBarPointerEnter: () => void;
  onBarPointerLeave: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        height: el.height * scale,
      }}
    >
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 size-full object-cover outline-none"
        src={src}
        poster={poster || undefined}
        muted
        playsInline
        preload="metadata"
        controls={false}
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 flex h-9 min-h-9 items-center gap-1 border-t border-white/15 bg-black/75 px-1 py-0.5 transition-opacity duration-200",
          barVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
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
  );
}

export function BookSlideCanvas({
  pageWidth,
  pageHeight,
  pageBackgroundColor,
  scale,
  elements,
  mode,
  selectedId,
  onSelect,
  onElementChange,
  onDropWidget,
  onReorderZ,
  onDeleteElement,
}: BookSlideCanvasProps) {
  const trRef = useRef<Konva.Transformer>(null);
  const selectedNodeRef = useRef<Konva.Node>(null);
  const videoBarHideTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [videoBarVisible, setVideoBarVisible] = useState<Record<string, boolean>>({});
  const [zMenu, setZMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);
  const zMenuRef = useRef<HTMLDivElement>(null);
  const elementContextMenuEnabled =
    mode === "edit" && (Boolean(onReorderZ) || Boolean(onDeleteElement));

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

  const openZMenu = useCallback(
    (elementId: string, clientX: number, clientY: number) => {
      if (!onReorderZ && !onDeleteElement) return;
      onSelect(elementId);
      setZMenu({ x: clientX, y: clientY, elementId });
    },
    [onDeleteElement, onReorderZ, onSelect],
  );

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

  useEffect(() => {
    const tr = trRef.current;
    const node = selectedNodeRef.current;
    if (mode !== "edit" || !tr || !node || !selectedId) {
      tr?.nodes([]);
      tr?.getLayer()?.batchDraw();
      return;
    }
    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [mode, selectedId, elements, pageWidth, pageHeight]);

  const sw = pageWidth * scale;
  const sh = pageHeight * scale;

  const dropEnabled = mode === "edit" && Boolean(onDropWidget);

  const parseDropKind = (e: DragEvent): BookDropWidgetKind | null => {
    const raw =
      e.dataTransfer.getData(BOOK_WIDGET_DRAG_TYPE) ||
      e.dataTransfer.getData("text/plain");
    if (raw === "text" || raw === "image" || raw === "video") return raw;
    return null;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!dropEnabled || !onDropWidget) return;
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
      className={cn(
        "relative inline-block ring-1 ring-border shadow-sm",
        dropEnabled && "ring-primary/40",
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
      {/* 슬라이드 배경은 HTML — Konva Stage를 비디오(z-0)보다 위에 두면 트랜스포머 앵커가 비디오에 가리지 않음 */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{ backgroundColor: pageBackgroundColor }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {elements
          .filter((e): e is Extract<BookCanvasElement, { type: "video" }> => e.type === "video")
          .map((el) => (
            <BookSlideVideoOverlay
              key={el.id}
              el={el}
              scale={scale}
              barVisible={Boolean(videoBarVisible[el.id])}
              onBarPointerEnter={() => showVideoBar(el.id)}
              onBarPointerLeave={() => scheduleHideVideoBar(el.id)}
            />
          ))}
      </div>
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
              onSelect(null);
            }}
          />
          {elements.map((el) => {
            const isSelected = el.id === selectedId;
            const attachRef = isSelected && mode === "edit";
            if (el.type === "text") {
              return (
                <BookTextHitShape
                  key={el.id}
                  el={el}
                  attachRef={attachRef}
                  selectedRef={selectedNodeRef}
                  mode={mode}
                  onSelect={onSelect}
                  onElementChange={onElementChange}
                  zMenuEnabled={elementContextMenuEnabled}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            }
            if (el.type === "image") {
              return (
                <BookImageShape
                  key={el.id}
                  el={el}
                  attachRef={attachRef}
                  selectedRef={selectedNodeRef}
                  mode={mode}
                  onSelect={onSelect}
                  onElementChange={onElementChange}
                  zMenuEnabled={elementContextMenuEnabled}
                  onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
                />
              );
            }
            return (
              <BookVideoBox
                key={el.id}
                el={el}
                attachRef={attachRef}
                selectedRef={selectedNodeRef}
                mode={mode}
                onSelect={onSelect}
                onElementChange={onElementChange}
                onVideoHoverEnter={() => showVideoBar(el.id)}
                onVideoHoverLeave={() => scheduleHideVideoBar(el.id)}
                zMenuEnabled={elementContextMenuEnabled}
                onZMenu={(cx, cy) => openZMenu(el.id, cx, cy)}
              />
            );
          })}
          {mode === "edit" && selectedId ? (
            <Transformer
              ref={trRef}
              rotateEnabled={false}
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
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
        {elements
          .filter((e): e is Extract<BookCanvasElement, { type: "text" }> => e.type === "text")
          .map((el) => (
            <BookTextWidgetOverlay
              key={el.id}
              el={el}
              scale={scale}
              mode={mode}
              isSelected={el.id === selectedId}
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
          ))}
      </div>
      {zMenu && (onReorderZ || onDeleteElement)
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
                  typeof window !== "undefined" ? Math.max(8, window.innerHeight - 280) : zMenu.y,
                ),
              }}
            >
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

/** 리치 텍스트는 HTML 오버레이로 그리고, Konva Rect는 조작·히트만 담당합니다. */
function BookTextHitShape({
  el,
  attachRef,
  selectedRef,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "text" }>;
  attachRef: boolean;
  selectedRef: MutableRefObject<Konva.Node | null>;
  mode: "edit" | "view";
  onSelect: (id: string | null) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const w = el.width ?? 720;
  const h = textWidgetHitHeight(el);
  return (
    <Rect
      ref={(node) => {
        if (attachRef) selectedRef.current = node;
        else if (selectedRef.current === node) selectedRef.current = null;
      }}
      x={el.x}
      y={el.y}
      width={w}
      height={h}
      fill="transparent"
      draggable={mode === "edit"}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect(el.id);
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
      onDragEnd={(e) => {
        onElementChange(el.id, { x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const nw = Math.max(24, node.width() * sx);
        const nh = Math.max(28, node.height() * sy);
        /* 박스(줄 너비·높이)만 바꿈 — 글자 크기는 속성 패널에서만 조절 */
        onElementChange(el.id, {
          x: node.x(),
          y: node.y(),
          width: nw,
          height: nh,
        });
      }}
    />
  );
}

function BookImageShape({
  el,
  attachRef,
  selectedRef,
  mode,
  onSelect,
  onElementChange,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "image" }>;
  attachRef: boolean;
  selectedRef: MutableRefObject<Konva.Node | null>;
  mode: "edit" | "view";
  onSelect: (id: string | null) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  const img = useBookImage(el.src);
  return (
    <KonvaImage
      ref={(node) => {
        if (attachRef) selectedRef.current = node;
        else if (selectedRef.current === node) selectedRef.current = null;
      }}
      image={img ?? undefined}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      draggable={mode === "edit"}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect(el.id);
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
      onDragEnd={(e) => {
        onElementChange(el.id, { x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const { w: nw, h: nh } = clampSize(node.width() * sx, node.height() * sy);
        onElementChange(el.id, {
          x: node.x(),
          y: node.y(),
          width: nw,
          height: nh,
        });
      }}
    />
  );
}

function BookVideoBox({
  el,
  attachRef,
  selectedRef,
  mode,
  onSelect,
  onElementChange,
  onVideoHoverEnter,
  onVideoHoverLeave,
  zMenuEnabled,
  onZMenu,
}: {
  el: Extract<BookCanvasElement, { type: "video" }>;
  attachRef: boolean;
  selectedRef: MutableRefObject<Konva.Node | null>;
  mode: "edit" | "view";
  onSelect: (id: string | null) => void;
  onElementChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  onVideoHoverEnter: () => void;
  onVideoHoverLeave: () => void;
  zMenuEnabled: boolean;
  onZMenu: (clientX: number, clientY: number) => void;
}) {
  return (
    <Rect
      ref={(node) => {
        if (attachRef) selectedRef.current = node;
        else if (selectedRef.current === node) selectedRef.current = null;
      }}
      x={el.x}
      y={el.y}
      width={el.width}
      height={el.height}
      fill="transparent"
      stroke={mode === "edit" ? "#cbd5e1" : "transparent"}
      strokeWidth={mode === "edit" ? 1 : 0}
      draggable={mode === "edit"}
      onMouseEnter={onVideoHoverEnter}
      onMouseLeave={onVideoHoverLeave}
      onMouseDown={(e) => {
        if (mode !== "edit") return;
        e.cancelBubble = true;
        onSelect(el.id);
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
      onDragEnd={(e) => {
        onElementChange(el.id, { x: e.target.x(), y: e.target.y() });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        const sx = node.scaleX();
        const sy = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const { w: nw, h: nh } = clampSize(node.width() * sx, node.height() * sy);
        onElementChange(el.id, {
          x: node.x(),
          y: node.y(),
          width: nw,
          height: nh,
        });
      }}
    />
  );
}

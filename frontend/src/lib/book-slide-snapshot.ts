import Konva from "konva";
import { publicAssetUrl } from "@/lib/api";
import type { BookCanvasElement } from "@/lib/book-canvas";
import {
  bookElementPivotKonva,
  DEFAULT_PAGE_BACKGROUND,
  resolveBookElementOpacity,
} from "@/lib/book-canvas";
import { computeKonvaFittedImageLayout } from "@/lib/book-media-layout";
import { getTextWidgetDisplayHtml, richHtmlToPlainText, textWidgetHitHeight } from "@/lib/book-text-widget";

export type BookSlideSnapshotPage = {
  backgroundColor: string;
  elements: BookCanvasElement[];
};

/** 사이드바 필름스트립(넓은 썸)에 맞춘 캡처 너비 */
const THUMB_MAX_WIDTH = 140;

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = dataUrl;
  });
}

/**
 * 썸네일 합성용 이미지. 직접 URL을 img에 넣고 `crossOrigin` 없이 로드하면 캔버스가 taint 되어
 * `toDataURL`이 실패할 수 있으므로, http(s)는 `fetch`(+ CORS 성공) 후 Data URL로만 넣습니다.
 */
async function loadImageForSnapshot(src: string): Promise<HTMLImageElement | null> {
  const u = publicAssetUrl(src) ?? src;
  if (!u) return null;

  if (u.startsWith("data:") || u.startsWith("blob:")) {
    return loadImageFromDataUrl(u);
  }

  try {
    const res = await fetch(u, { mode: "cors", credentials: "same-origin" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error("read"));
      fr.readAsDataURL(blob);
    });
    return loadImageFromDataUrl(dataUrl);
  } catch {
    return null;
  }
}

/**
 * 포스터가 없을 때 비디오 첫 프레임(또는 근처)을 캔버스로 뽑아 썸네일에 사용합니다.
 * CORS 실패 시 crossOrigin 없이 한 번 더 시도합니다.
 */
function loadVideoFrameAsImage(videoSrc: string, tryCors: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const u = publicAssetUrl(videoSrc) ?? videoSrc;
    if (!u) {
      resolve(null);
      return;
    }

    const video = document.createElement("video");
    if (tryCors) {
      video.crossOrigin = "anonymous";
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let settled = false;
    const timers: {
      fallback: ReturnType<typeof setTimeout> | null;
      hard: ReturnType<typeof setTimeout> | null;
    } = { fallback: null, hard: null };

    const finish = (img: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      if (timers.fallback != null) window.clearTimeout(timers.fallback);
      if (timers.hard != null) window.clearTimeout(timers.hard);
      video.removeAttribute("src");
      video.load();
      resolve(img);
    };

    const capture = () => {
      if (settled) return;
      try {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;
        const c = document.createElement("canvas");
        c.width = vw;
        c.height = vh;
        const ctx = c.getContext("2d");
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0);
        const dataUrl = c.toDataURL("image/png");
        const im = new Image();
        im.onload = () => finish(im);
        im.onerror = () => finish(null);
        im.src = dataUrl;
      } catch {
        finish(null);
      }
    };

    const seekForFrame = () => {
      if (settled) return;
      const d = video.duration;
      if (Number.isFinite(d) && d > 0.05) {
        const t = Math.min(0.12, Math.max(0.02, d * 0.03));
        video.currentTime = t;
      } else {
        video.currentTime = 0;
      }
    };

    const trySeekWhenReady = () => {
      if (settled) return;
      if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
      seekForFrame();
    };

    video.onloadedmetadata = () => trySeekWhenReady();
    video.onloadeddata = () => trySeekWhenReady();
    video.onseeked = () => capture();
    video.onerror = () => finish(null);

    timers.fallback = window.setTimeout(() => capture(), 700);
    timers.hard = window.setTimeout(() => {
      if (!settled) finish(null);
    }, 4500);

    video.src = u;
    void video.load();
  });
}

async function resolveVideoThumbnailImage(el: {
  src: string;
  posterSrc: string | null;
}): Promise<HTMLImageElement | null> {
  const poster =
    el.posterSrc != null && el.posterSrc !== ""
      ? (publicAssetUrl(el.posterSrc) ?? el.posterSrc)
      : null;
  if (poster) {
    const fromPoster = await loadImageForSnapshot(poster);
    if (fromPoster) return fromPoster;
  }
  let frame = await loadVideoFrameAsImage(el.src, true);
  if (!frame) frame = await loadVideoFrameAsImage(el.src, false);
  return frame;
}

/** 배경·요소가 바뀌었는지 판별용 서명 */
export function pageSnapshotSignature(p: BookSlideSnapshotPage): string {
  return `${p.backgroundColor}\0${JSON.stringify(p.elements)}`;
}

/**
 * 슬라이드 한 장을 작은 PNG 데이터 URL로 렌더합니다(페이지 썸네일용).
 * 텍스트는 `Konva.Text` + 평문(리치 HTML은 `richHtmlToPlainText`)만 사용합니다.
 * SVG foreignObject를 캔버스에 그리면 브라우저가 캔버스를 taint 해 `toDataURL`이 망가집니다.
 * HTML 비디오 오버레이는 포함되지 않으며, 포스터 이미지 또는 플레이스홀더로 대체합니다.
 */
export async function captureBookSlideToDataURL(
  page: BookSlideSnapshotPage,
  slideWidth: number,
  slideHeight: number,
  thumbWidthPx = THUMB_MAX_WIDTH,
): Promise<string | null> {
  if (slideWidth <= 0 || slideHeight <= 0) return null;

  const scale = thumbWidthPx / slideWidth;
  const thumbH = Math.max(1, Math.round(slideHeight * scale));

  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText =
    "position:fixed;left:-32000px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;";

  let stage: Konva.Stage | null = null;
  try {
    document.body.appendChild(container);

    stage = new Konva.Stage({
      container,
      width: thumbWidthPx,
      height: thumbH,
    });
    const layer = new Konva.Layer();
    stage.add(layer);

    const bg = page.backgroundColor?.trim() || DEFAULT_PAGE_BACKGROUND;
    layer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: thumbWidthPx,
        height: thumbH,
        fill: bg,
      }),
    );

    const sx = (v: number) => v * scale;

    for (const el of page.elements) {
      const elOp = resolveBookElementOpacity(el.opacity);
      if (el.type === "text") {
        const tw = sx(el.width ?? 720);
        const th = sx(textWidgetHitHeight(el));
        const tPivot = bookElementPivotKonva({
          x: sx(el.x),
          y: sx(el.y),
          width: tw,
          height: th,
          rotation: el.rotation,
        });
        const plain =
          richHtmlToPlainText(getTextWidgetDisplayHtml(el)) || el.text || " ";
        layer.add(
          new Konva.Text({
            x: tPivot.cx,
            y: tPivot.cy,
            offsetX: tPivot.offsetX,
            offsetY: tPivot.offsetY,
            rotation: tPivot.rotation,
            width: tw,
            height: th,
            text: plain,
            fontSize: Math.max(4, el.fontSize * scale),
            fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif',
            fill: el.fill?.trim() ? el.fill : "#111827",
            lineHeight: 1.35,
            wrap: "word",
            ellipsis: true,
            opacity: elOp,
          }),
        );
      } else if (el.type === "image") {
        const img = await loadImageForSnapshot(el.src);
        if (img) {
          const L = computeKonvaFittedImageLayout(
            el.objectFit,
            el.width,
            el.height,
            img.naturalWidth,
            img.naturalHeight,
          );
          const iw = sx(el.width);
          const ih = sx(el.height);
          const imgPivot = bookElementPivotKonva({
            x: sx(el.x),
            y: sx(el.y),
            width: iw,
            height: ih,
            rotation: el.rotation,
          });
          const g = new Konva.Group({
            x: imgPivot.cx,
            y: imgPivot.cy,
            offsetX: imgPivot.offsetX,
            offsetY: imgPivot.offsetY,
            rotation: imgPivot.rotation,
            opacity: elOp,
            clipFunc: (ctx) => {
              ctx.rect(0, 0, iw, ih);
            },
          });
          if (L.showLetterboxRect) {
            g.add(
              new Konva.Rect({
                x: 0,
                y: 0,
                width: sx(el.width),
                height: sx(el.height),
                fill: bg,
              }),
            );
          }
          const ki = new Konva.Image({
            x: sx(L.x),
            y: sx(L.y),
            width: sx(L.width),
            height: sx(L.height),
            image: img,
          });
          if (L.crop) ki.crop(L.crop);
          g.add(ki);
          layer.add(g);
        } else {
          layer.add(
            new Konva.Rect({
              x: sx(el.x),
              y: sx(el.y),
              width: sx(el.width),
              height: sx(el.height),
              fill: "#e5e7eb",
              stroke: "#94a3b8",
              strokeWidth: Math.max(0.5, scale),
              opacity: elOp,
            }),
          );
        }
      } else {
        const thumb = await resolveVideoThumbnailImage(el);
        if (thumb) {
          const L = computeKonvaFittedImageLayout(
            el.objectFit,
            el.width,
            el.height,
            thumb.naturalWidth,
            thumb.naturalHeight,
          );
          const vw = sx(el.width);
          const vh = sx(el.height);
          const vidPivot = bookElementPivotKonva({
            x: sx(el.x),
            y: sx(el.y),
            width: vw,
            height: vh,
            rotation: el.rotation,
          });
          const g = new Konva.Group({
            x: vidPivot.cx,
            y: vidPivot.cy,
            offsetX: vidPivot.offsetX,
            offsetY: vidPivot.offsetY,
            rotation: vidPivot.rotation,
            opacity: elOp,
            clipFunc: (ctx) => {
              ctx.rect(0, 0, vw, vh);
            },
          });
          if (L.showLetterboxRect) {
            g.add(
              new Konva.Rect({
                x: 0,
                y: 0,
                width: vw,
                height: vh,
                fill: bg,
              }),
            );
          }
          const ki = new Konva.Image({
            x: sx(L.x),
            y: sx(L.y),
            width: sx(L.width),
            height: sx(L.height),
            image: thumb,
          });
          if (L.crop) ki.crop(L.crop);
          g.add(ki);
          layer.add(g);
        } else {
          const vw = sx(el.width);
          const vh = sx(el.height);
          const vp = bookElementPivotKonva({
            x: sx(el.x),
            y: sx(el.y),
            width: vw,
            height: vh,
            rotation: el.rotation,
          });
          layer.add(
            new Konva.Rect({
              x: vp.cx,
              y: vp.cy,
              offsetX: vp.offsetX,
              offsetY: vp.offsetY,
              width: vw,
              height: vh,
              rotation: vp.rotation,
              fill: "#1e293b",
              strokeWidth: 0,
              opacity: elOp,
            }),
          );
        }
      }
    }

    layer.draw();

    try {
      return stage.toDataURL({
        pixelRatio: 1,
        mimeType: "image/png",
        quality: 0.9,
      });
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    stage?.destroy();
    container.remove();
  }
}

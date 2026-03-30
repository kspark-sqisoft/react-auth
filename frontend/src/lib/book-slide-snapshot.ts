import Konva from "konva";
import { publicAssetUrl } from "@/lib/api";
import type { BookCanvasElement } from "@/lib/book-canvas";
import {
  bookElementPivotKonva,
  bookWidgetBackdropAlphaFromCss,
  canvasRoundRectPath,
  DEFAULT_PAGE_BACKGROUND,
  isBookElementVisible,
  parseBookClockBackground,
  parseBookWeatherBackground,
  parseBookWidgetTextColor,
  resolveBookDigitalClockDisplay,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
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
      if (!isBookElementVisible(el)) continue;
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
        const tBr = sx(resolveBookElementBorderRadius(el));
        const tOw = resolveBookElementOutlineWidth(el);
        const tOc = resolveBookElementOutlineColor(el);
        const tg = new Konva.Group({
          x: tPivot.cx,
          y: tPivot.cy,
          offsetX: tPivot.offsetX,
          offsetY: tPivot.offsetY,
          rotation: tPivot.rotation,
          opacity: elOp,
          clipFunc: (ctx) => {
            canvasRoundRectPath(ctx as never, 0, 0, tw, th, tBr);
          },
        });
        tg.add(
          new Konva.Text({
            x: 0,
            y: 0,
            width: tw,
            height: th,
            text: plain,
            fontSize: Math.max(4, el.fontSize * scale),
            fontFamily: 'Geist Variable, ui-sans-serif, system-ui, sans-serif',
            fill: el.fill?.trim() ? el.fill : "#111827",
            lineHeight: 1.35,
            wrap: "word",
            ellipsis: true,
          }),
        );
        if (tOw > 0) {
          tg.add(
            new Konva.Rect({
              x: 0,
              y: 0,
              width: tw,
              height: th,
              cornerRadius: tBr,
              fillEnabled: false,
              stroke: tOc,
              strokeWidth: Math.max(0.5, sx(tOw)),
            }),
          );
        }
        layer.add(tg);
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
          const imgBr = sx(resolveBookElementBorderRadius(el));
          const imgOw = resolveBookElementOutlineWidth(el);
          const imgOc = resolveBookElementOutlineColor(el);
          const g = new Konva.Group({
            x: imgPivot.cx,
            y: imgPivot.cy,
            offsetX: imgPivot.offsetX,
            offsetY: imgPivot.offsetY,
            rotation: imgPivot.rotation,
            opacity: elOp,
            clipFunc: (ctx) => {
              canvasRoundRectPath(ctx as never, 0, 0, iw, ih, imgBr);
            },
          });
          const ki = new Konva.Image({
            x: sx(L.x),
            y: sx(L.y),
            width: sx(L.width),
            height: sx(L.height),
            image: img,
          });
          if (L.crop) ki.crop(L.crop);
          g.add(ki);
          if (imgOw > 0) {
            g.add(
              new Konva.Rect({
                x: 0,
                y: 0,
                width: iw,
                height: ih,
                cornerRadius: imgBr,
                fillEnabled: false,
                stroke: imgOc,
                strokeWidth: Math.max(0.5, sx(imgOw)),
              }),
            );
          }
          layer.add(g);
        } else {
          const iw = sx(el.width);
          const ih = sx(el.height);
          const ip = bookElementPivotKonva({
            x: sx(el.x),
            y: sx(el.y),
            width: iw,
            height: ih,
            rotation: el.rotation,
          });
          const fbBr = sx(resolveBookElementBorderRadius(el));
          const fbOw = resolveBookElementOutlineWidth(el);
          const fbOc = resolveBookElementOutlineColor(el);
          layer.add(
            new Konva.Rect({
              x: ip.cx,
              y: ip.cy,
              offsetX: ip.offsetX,
              offsetY: ip.offsetY,
              width: iw,
              height: ih,
              rotation: ip.rotation,
              cornerRadius: fbBr,
              fill: "#e5e7eb",
              stroke: fbOw > 0 ? fbOc : "#94a3b8",
              strokeWidth: fbOw > 0 ? Math.max(0.5, sx(fbOw)) : Math.max(0.5, scale),
              opacity: elOp,
            }),
          );
        }
      } else if (el.type === "video") {
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
          const vidBr = sx(resolveBookElementBorderRadius(el));
          const vidOw = resolveBookElementOutlineWidth(el);
          const vidOc = resolveBookElementOutlineColor(el);
          const g = new Konva.Group({
            x: vidPivot.cx,
            y: vidPivot.cy,
            offsetX: vidPivot.offsetX,
            offsetY: vidPivot.offsetY,
            rotation: vidPivot.rotation,
            opacity: elOp,
            clipFunc: (ctx) => {
              canvasRoundRectPath(ctx as never, 0, 0, vw, vh, vidBr);
            },
          });
          const ki = new Konva.Image({
            x: sx(L.x),
            y: sx(L.y),
            width: sx(L.width),
            height: sx(L.height),
            image: thumb,
          });
          if (L.crop) ki.crop(L.crop);
          g.add(ki);
          if (vidOw > 0) {
            g.add(
              new Konva.Rect({
                x: 0,
                y: 0,
                width: vw,
                height: vh,
                cornerRadius: vidBr,
                fillEnabled: false,
                stroke: vidOc,
                strokeWidth: Math.max(0.5, sx(vidOw)),
              }),
            );
          }
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
          const vfBr = sx(resolveBookElementBorderRadius(el));
          const vfOw = resolveBookElementOutlineWidth(el);
          const vfOc = resolveBookElementOutlineColor(el);
          layer.add(
            new Konva.Rect({
              x: vp.cx,
              y: vp.cy,
              offsetX: vp.offsetX,
              offsetY: vp.offsetY,
              width: vw,
              height: vh,
              rotation: vp.rotation,
              cornerRadius: vfBr,
              fill: "#1e293b",
              stroke: vfOw > 0 ? vfOc : "transparent",
              strokeWidth: vfOw > 0 ? Math.max(0.5, sx(vfOw)) : 0,
              opacity: elOp,
            }),
          );
        }
      } else if (el.type === "weather") {
        const ww = sx(el.width);
        const wh = sx(el.height);
        const wp = bookElementPivotKonva({
          x: sx(el.x),
          y: sx(el.y),
          width: ww,
          height: wh,
          rotation: el.rotation,
        });
        const thumbLabel =
          typeof el.cityQuery === "string" && el.cityQuery.trim()
            ? el.cityQuery.trim().slice(0, 20)
            : "날씨";
        const weatherFill = parseBookWeatherBackground(el.weatherBackground) ?? "#e0f2fe";
        const weatherStrokeA = bookWidgetBackdropAlphaFromCss(weatherFill);
        const weatherStrokeW = weatherStrokeA < 0.02 ? 0 : Math.max(0.5, scale);
        const weatherStroke =
          weatherStrokeW === 0 ? "transparent" : `rgba(14,165,233,${weatherStrokeA * 0.85})`;
        const wUserOw = resolveBookElementOutlineWidth(el);
        const wUserOc = resolveBookElementOutlineColor(el);
        const wCorner = sx(resolveBookElementBorderRadius(el));
        const wStroke = wUserOw > 0 ? wUserOc : weatherStroke;
        const wStrokeW = wUserOw > 0 ? Math.max(0.5, sx(wUserOw)) : weatherStrokeW;
        layer.add(
          new Konva.Rect({
            x: wp.cx,
            y: wp.cy,
            offsetX: wp.offsetX,
            offsetY: wp.offsetY,
            width: ww,
            height: wh,
            rotation: wp.rotation,
            fill: weatherFill,
            stroke: wStroke,
            strokeWidth: wStrokeW,
            cornerRadius: Math.max(0, wCorner),
            opacity: elOp,
          }),
        );
        const wTextFill = parseBookWidgetTextColor(el.weatherTextColor) ?? "#0369a1";
        layer.add(
          new Konva.Text({
            x: wp.cx,
            y: wp.cy,
            offsetX: wp.offsetX,
            offsetY: wp.offsetY,
            width: ww,
            height: wh,
            rotation: wp.rotation,
            text: thumbLabel,
            fontSize: Math.max(7, 11 * scale),
            fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif",
            fill: wTextFill,
            align: "center",
            verticalAlign: "middle",
            opacity: elOp,
          }),
        );
      } else if (el.type === "digitalClock") {
        const cw = sx(el.width);
        const ch = sx(el.height);
        const cp = bookElementPivotKonva({
          x: sx(el.x),
          y: sx(el.y),
          width: cw,
          height: ch,
          rotation: el.rotation,
        });
        const disp = resolveBookDigitalClockDisplay(el.clockDisplay);
        const now = new Date();
        const timeStr = now.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          ...(disp.seconds ? { second: "2-digit" } : {}),
          hour12: disp.hour12,
        });
        const dateStr = disp.date
          ? now.toLocaleDateString("ko-KR", {
              month: "numeric",
              day: "numeric",
              weekday: "short",
            })
          : "";
        const thumbLabel = dateStr ? `${timeStr}\n${dateStr}` : timeStr;
        const thumbBg = parseBookClockBackground(el.clockBackground) ?? "#0f172a";
        const clockStrokeA = bookWidgetBackdropAlphaFromCss(thumbBg);
        const clockStrokeW = clockStrokeA < 0.02 ? 0 : Math.max(0.5, scale);
        const clockStroke =
          clockStrokeW === 0 ? "transparent" : `rgba(148,163,184,${clockStrokeA * 0.62})`;
        const cUserOw = resolveBookElementOutlineWidth(el);
        const cUserOc = resolveBookElementOutlineColor(el);
        const cCorner = sx(resolveBookElementBorderRadius(el));
        const cStroke = cUserOw > 0 ? cUserOc : clockStroke;
        const cStrokeW = cUserOw > 0 ? Math.max(0.5, sx(cUserOw)) : clockStrokeW;
        layer.add(
          new Konva.Rect({
            x: cp.cx,
            y: cp.cy,
            offsetX: cp.offsetX,
            offsetY: cp.offsetY,
            width: cw,
            height: ch,
            rotation: cp.rotation,
            fill: thumbBg,
            stroke: cStroke,
            strokeWidth: cStrokeW,
            cornerRadius: Math.max(0, cCorner),
            opacity: elOp,
          }),
        );
        const cTextFill = parseBookWidgetTextColor(el.clockTextColor) ?? "#e2e8f0";
        layer.add(
          new Konva.Text({
            x: cp.cx,
            y: cp.cy,
            offsetX: cp.offsetX,
            offsetY: cp.offsetY,
            width: cw,
            height: ch,
            rotation: cp.rotation,
            text: thumbLabel,
            fontSize: Math.max(6, 9 * scale),
            fontFamily: "ui-monospace, monospace",
            fill: cTextFill,
            align: "center",
            verticalAlign: "middle",
            opacity: elOp,
          }),
        );
      } else if (el.type === "drawing") {
        const dw = sx(el.width);
        const dh = sx(el.height);
        const dp = bookElementPivotKonva({
          x: sx(el.x),
          y: sx(el.y),
          width: dw,
          height: dh,
          rotation: el.rotation,
        });
        const scaledPts = el.points.map((v) => v * scale);
        if (scaledPts.length >= 4) {
          const g = new Konva.Group({
            x: dp.cx,
            y: dp.cy,
            offsetX: dp.offsetX,
            offsetY: dp.offsetY,
            rotation: dp.rotation,
            opacity: elOp,
          });
          g.add(
            new Konva.Line({
              points: scaledPts,
              stroke: el.stroke,
              strokeWidth: Math.max(0.5, sx(el.strokeWidth)),
              lineCap: "round",
              lineJoin: "round",
            }),
          );
          layer.add(g);
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

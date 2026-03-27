/**
 * 북 슬라이드 캔버스(Konva)와 API `elementsJson`에 맞춘 요소 타입.
 */

import type Konva from "konva";

export const BOOK_MEDIA_OBJECT_FIT_VALUES = ["cover", "contain", "fill", "none", "scale-down"] as const;
export type BookMediaObjectFit = (typeof BOOK_MEDIA_OBJECT_FIT_VALUES)[number];
export const DEFAULT_BOOK_MEDIA_OBJECT_FIT: BookMediaObjectFit = "cover";

export function parseBookMediaObjectFit(raw: unknown): BookMediaObjectFit | undefined {
  if (typeof raw !== "string") return undefined;
  return (BOOK_MEDIA_OBJECT_FIT_VALUES as readonly string[]).includes(raw)
    ? (raw as BookMediaObjectFit)
    : undefined;
}

export function resolveBookMediaObjectFit(raw: BookMediaObjectFit | undefined): BookMediaObjectFit {
  return raw ?? DEFAULT_BOOK_MEDIA_OBJECT_FIT;
}

/** 요소 불투명도 0~1. 생략 시 1(완전 불투명). */
export const DEFAULT_BOOK_ELEMENT_OPACITY = 1;

export function resolveBookElementOpacity(opacity: number | undefined): number {
  if (typeof opacity !== "number" || !Number.isFinite(opacity)) return DEFAULT_BOOK_ELEMENT_OPACITY;
  return Math.min(1, Math.max(0, opacity));
}

/** 도(°) 단위, 생략 시 0 */
export const DEFAULT_BOOK_ELEMENT_ROTATION = 0;

export function resolveBookElementRotation(deg: number | undefined): number {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return DEFAULT_BOOK_ELEMENT_ROTATION;
  return deg;
}

/**
 * 저장값: (x,y) = Konva `getTransform().point({0,0})` (로컬 왼쪽 위), rotation = `node.rotation()` 도.
 * 피벗 (cx,cy) = `node.x()/y()` 와 같아야 하며, TL에서 중심까지 벡터 (w/2,h/2)를 rotation만큼 돌린 값을 더합니다.
 * (Konva 10 `Rect` + offset 반크기로 런타임 대조해 부호 확정.)
 */
export function bookElementPivotKonva(el: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): { cx: number; cy: number; offsetX: number; offsetY: number; rotation: number } {
  const w = el.width;
  const h = el.height;
  const deg = resolveBookElementRotation(el.rotation);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = el.x + (w / 2) * cos - (h / 2) * sin;
  const cy = el.y + (w / 2) * sin + (h / 2) * cos;
  return {
    cx,
    cy,
    offsetX: w / 2,
    offsetY: h / 2,
    rotation: deg,
  };
}

/**
 * HTML 오버레이(`transform-origin: center`)용: 부모 좌표에서 회전축(중심)이 (cx,cy)가 되도록
 * 배치 박스의 왼쪽 위(논리 좌표).
 */
export function bookElementOverlayTopLeftFromPivot(
  pivot: ReturnType<typeof bookElementPivotKonva>,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: pivot.cx - width / 2,
    y: pivot.cy - height / 2,
  };
}

/**
 * 드래그·변형 후 저장용 (x,y): 로컬 원점 (0,0)이 박스 왼쪽 위일 때( Rect / clip 과 동일 ),
 * Konva가 적용하는 변환 순서와 동일하게 부모 좌표로 옮깁니다. 수식 역변환보다 정확합니다.
 */
export function konvaBookTopLeftFromNode(node: Konva.Node): { x: number; y: number } {
  const p = node.getTransform().point({ x: 0, y: 0 });
  return { x: p.x, y: p.y };
}

export type BookCanvasElement =
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      /** 평문(썸네일·검색·구버전 호환). 리치 HTML과 함께 유지합니다. */
      text: string;
      /** TipTap 등에서 생성한 정제된 HTML 조각(선택). */
      richHtml?: string;
      fontSize: number;
      fill: string;
      width?: number;
      /** 리치 텍스트 박스 논리 높이(Konva 히트·오버레이). 없으면 기본값 계산. */
      height?: number;
      /** 0~1, 생략 시 1 */
      opacity?: number;
      /** 시계 방향 도(°), 생략 시 0 */
      rotation?: number;
    }
  | {
      id: string;
      type: "image";
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      /** 프레임 안 표시 방식(CSS object-fit과 동일). 생략 시 cover */
      objectFit?: BookMediaObjectFit;
      opacity?: number;
      rotation?: number;
    }
  | {
      id: string;
      type: "video";
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
      posterSrc: string | null;
      objectFit?: BookMediaObjectFit;
      opacity?: number;
      rotation?: number;
    }
  | {
      id: string;
      type: "weather";
      x: number;
      y: number;
      width: number;
      height: number;
      /** OpenWeather Geocoding 쿼리. 비우면 서울. 예: `Seoul,KR` */
      cityQuery?: string;
      /** 항목별 표시. `false`만 숨김, 생략·undefined는 표시(기본). */
      weatherDisplay?: BookWeatherDisplay;
      opacity?: number;
      rotation?: number;
    };

/** 날씨 위젯 표시 플래그(저장용). `false` = 숨김. */
export type BookWeatherDisplay = Partial<{
  temp: boolean;
  feelsLike: boolean;
  description: boolean;
  icon: boolean;
  humidity: boolean;
  wind: boolean;
  pm25: boolean;
  pm10: boolean;
  aqi: boolean;
  clock: boolean;
  date: boolean;
}>;

export type BookWeatherDisplayResolved = {
  temp: boolean;
  feelsLike: boolean;
  description: boolean;
  icon: boolean;
  humidity: boolean;
  wind: boolean;
  pm25: boolean;
  pm10: boolean;
  aqi: boolean;
  clock: boolean;
  date: boolean;
};

/** 모두 끄면 기본(전체 표시)으로 되돌립니다. */
export function resolveBookWeatherDisplay(raw?: BookWeatherDisplay | null): BookWeatherDisplayResolved {
  const out: BookWeatherDisplayResolved = {
    temp: raw?.temp !== false,
    feelsLike: raw?.feelsLike !== false,
    description: raw?.description !== false,
    icon: raw?.icon !== false,
    humidity: raw?.humidity !== false,
    wind: raw?.wind !== false,
    pm25: raw?.pm25 !== false,
    pm10: raw?.pm10 !== false,
    aqi: raw?.aqi !== false,
    clock: raw?.clock !== false,
    date: raw?.date !== false,
  };
  if (!Object.values(out).some(Boolean)) {
    return {
      temp: true,
      feelsLike: true,
      description: true,
      icon: true,
      humidity: true,
      wind: true,
      pm25: true,
      pm10: true,
      aqi: true,
      clock: true,
      date: true,
    };
  }
  return out;
}

export type BookEditorPageState = {
  /** 목록 key·드래그 식별(서버 페이지는 보통 `srv-{id}`) */
  clientKey: string;
  sortOrder: number;
  /** 비우면 사이드바에 "슬라이드 n" 표시 */
  name: string;
  /** 슬라이드 배경(CSS 색, Konva Stage 배경과 동일) */
  backgroundColor: string;
  elements: BookCanvasElement[];
};

export const DEFAULT_SLIDE_WIDTH = 960;
export const DEFAULT_SLIDE_HEIGHT = 540;

/** 날씨 위젯 기본 프레임(px) — 가로 카드 비율 */
export const DEFAULT_BOOK_WEATHER_WIDGET_WIDTH = 340;
export const DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT = 156;
export const DEFAULT_PAGE_BACKGROUND = "#ffffff";

const PAGE_BG_MAX_LEN = 64;

/** 페이지 배경 문자열 정리(빈 값·위험 패턴은 기본 흰색). */
export function sanitizePageBackgroundColor(raw: string): string {
  const s = raw.trim().slice(0, PAGE_BG_MAX_LEN);
  if (!s) return DEFAULT_PAGE_BACKGROUND;
  if (/[<>]/.test(s) || /url\s*\(/i.test(s)) return DEFAULT_PAGE_BACKGROUND;
  return s;
}

export function slideDisplayLabel(name: string | undefined | null, indexZero: number): string {
  const t = name?.trim();
  if (t) return t;
  return `슬라이드 ${indexZero + 1}`;
}

/** 빈 제목 또는 `슬라이드 12` 형태만 현재 순서에 맞게 다시 번호 매김(직접 지은 제목은 유지). */
export const AUTO_SLIDE_TITLE_RE = /^슬라이드\s*\d+$/;

export function applyAutoSlideNamesByIndex(pages: BookEditorPageState[]): BookEditorPageState[] {
  return pages.map((p, i) => {
    const t = (p.name ?? "").trim();
    if (t === "" || AUTO_SLIDE_TITLE_RE.test(t)) {
      return { ...p, name: `슬라이드 ${i + 1}` };
    }
    return p;
  });
}

export function createEmptyEditorPage(sortOrder: number): BookEditorPageState {
  return {
    clientKey: crypto.randomUUID(),
    sortOrder,
    name: "",
    backgroundColor: DEFAULT_PAGE_BACKGROUND,
    elements: [],
  };
}

/** 같은 내용의 새 페이지(새 `clientKey`·요소 `id`). 목록에 바로 아래에 끼워 넣은 뒤 `applyAutoSlideNamesByIndex` 권장. */
export function duplicateBookEditorPage(page: BookEditorPageState): BookEditorPageState {
  const elements = page.elements.map((el) => {
    const id = crypto.randomUUID();
    if (el.type === "text") {
      return { ...el, id };
    }
    if (el.type === "image") {
      return { ...el, id };
    }
    if (el.type === "weather") {
      return {
        ...el,
        id,
        ...(el.cityQuery !== undefined ? { cityQuery: el.cityQuery } : {}),
        ...(el.weatherDisplay !== undefined ? { weatherDisplay: { ...el.weatherDisplay } } : {}),
      };
    }
    return { ...el, id };
  });
  return {
    clientKey: crypto.randomUUID(),
    sortOrder: page.sortOrder,
    name: page.name,
    backgroundColor: page.backgroundColor,
    elements,
  };
}

/** PATCH /books/:id `pages` 본문용 */
export function toBookPagePayloads(pages: BookEditorPageState[]) {
  return pages.map((p, i) => ({
    sortOrder: i,
    name: p.name,
    backgroundColor: sanitizePageBackgroundColor(
      p.backgroundColor || DEFAULT_PAGE_BACKGROUND,
    ),
    elements: p.elements,
  }));
}

export function reorderPagesArray<T>(pages: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) {
    return pages;
  }
  const next = [...pages];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/** 드래그로 `from`→`to` 이동한 뒤, 이전에 `active`였던 페이지의 새 인덱스 */
export function pageIndexAfterReorder(active: number, from: number, to: number): number {
  if (from === to) return active;
  if (active === from) return to;
  if (from < to) {
    if (active > from && active <= to) return active - 1;
    return active;
  }
  if (active >= to && active < from) return active + 1;
  return active;
}

/** `removedIndex` 페이지를 제거한 뒤 선택 인덱스를 보정합니다. */
export function pageIndexAfterRemove(
  active: number,
  removedIndex: number,
  prevLength: number,
): number {
  if (prevLength <= 1) return 0;
  const newLen = prevLength - 1;
  if (removedIndex < active) return active - 1;
  if (removedIndex === active) return Math.min(active, newLen - 1);
  return active;
}

/** 슬라이드 요소 배열: 앞쪽이 아래(먼저 그림), 뒤쪽이 위 */
export type ElementZOrderOp = "forward" | "backward" | "front" | "back";

export function reorderElementsZ(
  elements: BookCanvasElement[],
  elementId: string,
  op: ElementZOrderOp,
): BookCanvasElement[] {
  const i = elements.findIndex((e) => e.id === elementId);
  if (i === -1) return elements;
  const next = [...elements];

  if (op === "front") {
    const [item] = next.splice(i, 1);
    next.push(item);
    return next;
  }
  if (op === "back") {
    const [item] = next.splice(i, 1);
    next.unshift(item);
    return next;
  }
  if (op === "forward") {
    if (i >= next.length - 1) return elements;
    const [item] = next.splice(i, 1);
    next.splice(i + 1, 0, item);
    return next;
  }
  if (op === "backward") {
    if (i <= 0) return elements;
    const [item] = next.splice(i, 1);
    next.splice(i - 1, 0, item);
    return next;
  }
  return elements;
}

function parseElementOpacity(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const v = Math.min(1, Math.max(0, raw));
  return v === DEFAULT_BOOK_ELEMENT_OPACITY ? undefined : v;
}

function parseElementRotation(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const v = Math.min(360, Math.max(-360, raw));
  return v === DEFAULT_BOOK_ELEMENT_ROTATION ? undefined : v;
}

const WEATHER_DISPLAY_KEYS = [
  "temp",
  "feelsLike",
  "description",
  "icon",
  "humidity",
  "wind",
  "pm25",
  "pm10",
  "aqi",
  "clock",
  "date",
] as const;

function parseBookWeatherDisplay(raw: unknown): BookWeatherDisplay | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: BookWeatherDisplay = {};
  let any = false;
  for (const k of WEATHER_DISPLAY_KEYS) {
    if (k in o && typeof o[k] === "boolean") {
      (out as Record<string, boolean>)[k] = o[k] as boolean;
      any = true;
    }
  }
  return any ? out : undefined;
}

export function normalizeBookElements(raw: unknown[]): BookCanvasElement[] {
  const out: BookCanvasElement[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.type !== "string") continue;
    const opacity = parseElementOpacity(o.opacity);
    const rotation = parseElementRotation(o.rotation);
    if (o.type === "text") {
      const width = typeof o.width === "number" ? o.width : undefined;
      const height = typeof o.height === "number" ? o.height : undefined;
      out.push({
        id: o.id,
        type: "text",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        text: typeof o.text === "string" ? o.text : "",
        ...(typeof o.richHtml === "string" && o.richHtml.length > 0
          ? { richHtml: o.richHtml }
          : {}),
        fontSize: typeof o.fontSize === "number" ? o.fontSize : 24,
        fill: typeof o.fill === "string" ? o.fill : "#111827",
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
      });
    } else if (o.type === "image") {
      const objectFit = parseBookMediaObjectFit(o.objectFit);
      out.push({
        id: o.id,
        type: "image",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || 320,
        height: Number(o.height) || 180,
        src: typeof o.src === "string" ? o.src : "",
        ...(objectFit ? { objectFit } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
      });
    } else if (o.type === "video") {
      const objectFit = parseBookMediaObjectFit(o.objectFit);
      out.push({
        id: o.id,
        type: "video",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || 480,
        height: Number(o.height) || 270,
        src: typeof o.src === "string" ? o.src : "",
        posterSrc:
          typeof o.posterSrc === "string" && o.posterSrc.length > 0
            ? o.posterSrc
            : null,
        ...(objectFit ? { objectFit } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
      });
    } else if (o.type === "weather") {
      const cityQuery =
        typeof o.cityQuery === "string" && o.cityQuery.trim().length > 0
          ? o.cityQuery.trim().slice(0, 120)
          : undefined;
      const wd = parseBookWeatherDisplay(o.weatherDisplay);
      out.push({
        id: o.id,
        type: "weather",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || DEFAULT_BOOK_WEATHER_WIDGET_WIDTH,
        height: Number(o.height) || DEFAULT_BOOK_WEATHER_WIDGET_HEIGHT,
        ...(cityQuery !== undefined ? { cityQuery } : {}),
        ...(wd !== undefined ? { weatherDisplay: wd } : {}),
        ...(opacity !== undefined ? { opacity } : {}),
        ...(rotation !== undefined ? { rotation } : {}),
      });
    }
  }
  return out;
}

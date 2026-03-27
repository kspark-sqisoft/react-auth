/**
 * 북 슬라이드 캔버스(Konva)와 API `elementsJson`에 맞춘 요소 타입.
 */

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
    }
  | {
      id: string;
      type: "image";
      x: number;
      y: number;
      width: number;
      height: number;
      src: string;
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
    };

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

export function normalizeBookElements(raw: unknown[]): BookCanvasElement[] {
  const out: BookCanvasElement[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.type !== "string") continue;
    if (o.type === "text") {
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
        ...(typeof o.width === "number" ? { width: o.width } : {}),
        ...(typeof o.height === "number" ? { height: o.height } : {}),
      });
    } else if (o.type === "image") {
      out.push({
        id: o.id,
        type: "image",
        x: Number(o.x) || 0,
        y: Number(o.y) || 0,
        width: Number(o.width) || 320,
        height: Number(o.height) || 180,
        src: typeof o.src === "string" ? o.src : "",
      });
    } else if (o.type === "video") {
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
      });
    }
  }
  return out;
}

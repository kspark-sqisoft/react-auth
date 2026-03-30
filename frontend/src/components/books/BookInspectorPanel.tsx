import { Expand, SlidersHorizontal, Trash2 } from "lucide-react";
import {
  BOOK_MEDIA_OBJECT_FIT_VALUES,
  BOOK_WIDGET_DEFAULT_ROUNDED_RADIUS,
  type BookCanvasElement,
  type BookDigitalClockDisplay,
  type BookDigitalClockDisplayResolved,
  type BookMediaObjectFit,
  type BookWeatherDisplay,
  type BookWeatherDisplayResolved,
  parseBookClockBackground,
  parseBookWidgetTextColor,
  resolveBookDigitalClockDisplay,
  resolveBookElementBorderRadius,
  resolveBookElementOpacity,
  resolveBookElementOutlineColor,
  resolveBookElementOutlineWidth,
  resolveBookElementRotation,
  resolveBookMediaObjectFit,
  resolveBookWeatherDisplay,
  isBookElementLocked,
} from "@/lib/book-canvas";
import {
  defaultTextWidgetBoxHeight,
  getTextWidgetDisplayHtml,
} from "@/lib/book-text-widget";
import { BookTextRichEditor } from "@/components/books/BookTextRichEditor";
import { BOOK_HEX_COLOR_PRESETS } from "@/lib/book-color-presets";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BookInspectorPanelProps = {
  selected: BookCanvasElement | null;
  /** 슬라이드 논리 크기 — 전체 맞춤 버튼에 사용 */
  slideWidth: number;
  slideHeight: number;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
  onDelete: () => void;
  mediaHint?: string | null;
  /** 오른쪽 컬럼 안(레이어 패널 아래)에 넣을 때: 테두리·고정 너비 제거 */
  embedded?: boolean;
};

function num(v: string, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const WEATHER_INSPECTOR_FIELDS: { key: keyof BookWeatherDisplayResolved; label: string }[] = [
  { key: "temp", label: "기온" },
  { key: "feelsLike", label: "체감 온도" },
  { key: "description", label: "상태 설명" },
  { key: "icon", label: "날씨 아이콘" },
  { key: "humidity", label: "습도" },
  { key: "wind", label: "바람" },
  { key: "pm10", label: "미세먼지 (PM10)" },
  { key: "pm25", label: "초미세먼지 (PM2.5)" },
  { key: "aqi", label: "대기질 지수" },
  { key: "clock", label: "시계" },
  { key: "date", label: "날짜" },
];

function patchWeatherDisplay(
  current: BookWeatherDisplay | undefined,
  key: keyof BookWeatherDisplayResolved,
  checked: boolean,
): BookWeatherDisplay | undefined {
  const next: BookWeatherDisplay = { ...current };
  if (checked) {
    delete next[key];
  } else {
    next[key] = false;
  }
  if (Object.keys(next).length === 0) return undefined;
  return next;
}

const DIGITAL_CLOCK_INSPECTOR_FIELDS: { key: keyof BookDigitalClockDisplayResolved; label: string }[] = [
  { key: "seconds", label: "초 표시" },
  { key: "date", label: "날짜 표시" },
  { key: "hour12", label: "12시간(AM/PM)" },
];

function patchDigitalClockDisplay(
  current: BookDigitalClockDisplay | undefined,
  key: keyof BookDigitalClockDisplayResolved,
  checked: boolean,
): BookDigitalClockDisplay | undefined {
  const next: BookDigitalClockDisplay = { ...current };
  if (key === "hour12") {
    if (checked) next.hour12 = true;
    else delete next.hour12;
  } else {
    if (checked) delete next[key];
    else next[key] = false;
  }
  if (Object.keys(next).length === 0) return undefined;
  return next;
}

function digitalClockHexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6) {
    return `rgba(15,23,42,${Math.min(1, Math.max(0, alpha))})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) {
    return `rgba(15,23,42,${Math.min(1, Math.max(0, alpha))})`;
  }
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

function parseDigitalClockBgForInspector(raw: string | undefined): { hex: string; alpha: number } {
  const fallback = { hex: "#0f172a", alpha: 0.92 };
  if (!raw?.trim()) return fallback;
  const s = raw.trim();
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (m) {
    const r = Math.min(255, Math.max(0, parseInt(m[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(m[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(m[3], 10)));
    const a = m[4] != null ? Math.min(1, Math.max(0, parseFloat(m[4]))) : 1;
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: a };
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return { hex: s, alpha: 1 };
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1] + s[1];
    const g = s[2] + s[2];
    const b = s[3] + s[3];
    return { hex: `#${r}${g}${b}`, alpha: 1 };
  }
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {
    const r = parseInt(s.slice(1, 3), 16);
    const g = parseInt(s.slice(3, 5), 16);
    const b = parseInt(s.slice(5, 7), 16);
    const aByte = parseInt(s.slice(7, 9), 16);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return {
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      alpha: Number.isFinite(aByte) ? Math.min(1, Math.max(0, aByte / 255)) : 1,
    };
  }
  return fallback;
}

type WidgetBackdropFieldKey = "clockBackground" | "weatherBackground";
type WidgetTextColorFieldKey = "weatherTextColor" | "clockTextColor";

function OptionalWidgetTextColorFields({
  elementId,
  value,
  field,
  defaultHex,
  colorAriaLabel,
  defaultHint,
  onChange,
}: {
  elementId: string;
  value: string | undefined;
  field: WidgetTextColorFieldKey;
  defaultHex: string;
  colorAriaLabel: string;
  defaultHint: string;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const sanitized = parseBookWidgetTextColor(value);
  const usesCustom = Boolean(sanitized);
  const { hex } = parseDigitalClockBgForInspector(sanitized);
  const colorInputValue =
    sanitized && /^#[0-9a-fA-F]{6}$/i.test(hex) ? hex : defaultHex;

  const patch = (next: string | undefined) =>
    onChange(elementId, { [field]: next } as Partial<BookCanvasElement>);

  return (
    <div className="space-y-2">
      <Label>텍스트 색</Label>
      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
        <Checkbox
          checked={usesCustom}
          onCheckedChange={(c) => {
            if (c === true) {
              patch(digitalClockHexToRgba(defaultHex, 1));
            } else {
              patch(undefined);
            }
          }}
        />
        <span>사용자 지정</span>
      </label>
      {usesCustom ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="color"
            className="h-9 w-14 shrink-0 cursor-pointer px-1"
            value={colorInputValue}
            onChange={(e) => patch(digitalClockHexToRgba(e.target.value, 1))}
            aria-label={colorAriaLabel}
          />
          <span className="text-[11px] text-muted-foreground">
            본문·아이콘(선)에 적용됩니다.
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{defaultHint}</p>
      )}
    </div>
  );
}

function OptionalWidgetBackdropFields({
  elementId,
  value,
  field,
  defaultRgba,
  colorAriaLabel,
  defaultHint,
  onChange,
}: {
  elementId: string;
  value: string | undefined;
  field: WidgetBackdropFieldKey;
  defaultRgba: string;
  colorAriaLabel: string;
  defaultHint: string;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const sanitized = parseBookClockBackground(value);
  const usesCustom = Boolean(sanitized);
  const { hex, alpha } = parseDigitalClockBgForInspector(sanitized);
  const alphaPct = Math.round(alpha * 100);
  const colorInputValue = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#0f172a";

  const patch = (next: string | undefined) =>
    onChange(elementId, { [field]: next } as Partial<BookCanvasElement>);

  return (
    <div className="space-y-2">
      <Label>배경</Label>
      <label className="flex cursor-pointer items-center gap-2 text-sm leading-none">
        <Checkbox
          checked={usesCustom}
          onCheckedChange={(c) => {
            if (c === true) {
              patch(defaultRgba);
            } else {
              patch(undefined);
            }
          }}
        />
        <span>사용자 배경색</span>
      </label>
      {usesCustom ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="color"
              className="h-9 w-14 shrink-0 cursor-pointer px-1"
              value={colorInputValue}
              onChange={(e) => patch(digitalClockHexToRgba(e.target.value, alpha))}
              aria-label={colorAriaLabel}
            />
            <span className="text-[11px] text-muted-foreground">
              색상 · 슬라이더는 배경 투명도(테두리·그림자도 같이 줄어듭니다)
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>배경 투명도</span>
              <span className="tabular-nums">{alphaPct}%</span>
            </div>
            <Slider
              value={[alphaPct]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => patch(digitalClockHexToRgba(colorInputValue, v / 100))}
            />
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">{defaultHint}</p>
      )}
    </div>
  );
}

const MEDIA_FIT_LABELS: Record<BookMediaObjectFit, string> = {
  cover: "꽉 채움 (비율 유지, 잘림)",
  contain: "전체 보임 (여백)",
  fill: "늘이기",
  none: "원본 크기 (왼쪽 위)",
  "scale-down": "줄여 맞춤 (확대 없음)",
};

function outlineInspectorHex(resolvedColor: string): string {
  const t = resolvedColor.trim();
  if (/^#[0-9a-fA-F]{6}$/i.test(t)) return t;
  const m = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
    return `#${toHex(+m[1])}${toHex(+m[2])}${toHex(+m[3])}`;
  }
  return "#94a3b8";
}

function ElementShapeChromeFields({
  el,
  onChange,
}: {
  el: BookCanvasElement;
  onChange: BookInspectorPanelProps["onChange"];
}) {
  const br = resolveBookElementBorderRadius(el);
  const ow = resolveBookElementOutlineWidth(el);
  const ocResolved = resolveBookElementOutlineColor(el);
  const colorPick = outlineInspectorHex(ocResolved);

  const typeHint =
    el.type === "weather" || el.type === "digitalClock"
      ? `저장하지 않으면 기본 ${BOOK_WIDGET_DEFAULT_ROUNDED_RADIUS}px(둥근 카드)입니다.`
      : "텍스트·이미지·동영상은 기본 0(각진 모서리)입니다.";

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Label className="text-xs font-medium">모양</Label>
      <p className="text-[11px] text-muted-foreground">{typeHint}</p>
      <div className="space-y-1">
        <Label htmlFor={`insp-br-${el.id}`}>모서리 반지름 (px)</Label>
        <Input
          id={`insp-br-${el.id}`}
          type="number"
          min={0}
          max={2000}
          value={br}
          onChange={(e) =>
            onChange(el.id, {
              borderRadius: num(e.target.value, br, 0, 2000),
            })
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`insp-ow-${el.id}`}>외곽선 두께 (px)</Label>
        <Input
          id={`insp-ow-${el.id}`}
          type="number"
          min={0}
          max={32}
          value={ow}
          onChange={(e) => {
            const v = num(e.target.value, ow, 0, 32);
            onChange(el.id, {
              outlineWidth: v > 0 ? v : undefined,
              ...(v <= 0 ? { outlineColor: undefined } : {}),
            });
          }}
        />
      </div>
      {ow > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`insp-oc-${el.id}`}
            type="color"
            className="h-9 w-14 shrink-0 cursor-pointer px-1"
            value={/^#[0-9a-fA-F]{6}$/i.test(colorPick) ? colorPick : "#94a3b8"}
            onChange={(e) =>
              onChange(el.id, {
                outlineColor: e.target.value,
              })
            }
            aria-label="외곽선 색"
          />
          <span className="text-[11px] text-muted-foreground">외곽선 색</span>
        </div>
      ) : null}
    </div>
  );
}

function ElementOpacitySlider({
  elementId,
  opacity,
  onChange,
}: {
  elementId: string;
  opacity: number | undefined;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
}) {
  const pct = Math.round(resolveBookElementOpacity(opacity) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`insp-op-${elementId}`}>불투명도</Label>
        <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <Slider
        id={`insp-op-${elementId}`}
        min={0}
        max={100}
        step={1}
        value={[pct]}
        onValueChange={([v]) => {
          const clamped = Math.min(100, Math.max(0, v));
          onChange(elementId, {
            opacity: clamped >= 100 ? undefined : clamped / 100,
          });
        }}
      />
      <p className="text-[11px] text-muted-foreground">
        0%는 완전 투명, 100%는 불투명입니다.
      </p>
    </div>
  );
}

function MediaObjectFitFields({
  elementId,
  value,
  onChange,
}: {
  elementId: string;
  value: BookMediaObjectFit | undefined;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
}) {
  const v = resolveBookMediaObjectFit(value);
  return (
    <div className="space-y-1">
      <Label htmlFor="insp-objfit">프레임 맞춤</Label>
      <Select
        value={v}
        onValueChange={(next) =>
          onChange(elementId, { objectFit: next as BookMediaObjectFit })
        }
      >
        <SelectTrigger id="insp-objfit" className="w-full max-w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOOK_MEDIA_OBJECT_FIT_VALUES.map((fit) => (
            <SelectItem key={fit} value={fit}>
              {MEDIA_FIT_LABELS[fit]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BookInspectorPanel({
  selected,
  slideWidth,
  slideHeight,
  onChange,
  onDelete,
  mediaHint,
  embedded = false,
}: BookInspectorPanelProps) {
  const Root = embedded ? "div" : "aside";
  return (
    <Root
      className={cn(
        "flex h-full min-h-0 max-h-full flex-col overflow-hidden bg-card/50",
        embedded ? "min-w-0" : "w-80 shrink-0 border-l border-border",
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">위젯 속성</span>
      </div>
      <div className="min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="space-y-4 p-3">
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              캔버스에서 위젯을 선택하면 여기서 글자·위치·크기를 바꿀 수 있습니다.
            </p>
          ) : (
            <>
              {isBookElementLocked(selected) ? (
                <p className="mb-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-xs text-amber-900 dark:text-amber-100">
                  잠긴 위젯입니다. 레이어 목록의 자물쇠로 잠금을 해제한 뒤 편집할 수 있습니다.
                </p>
              ) : null}
              <div
                className={cn(
                  "space-y-4",
                  isBookElementLocked(selected) && "pointer-events-none opacity-[0.68]",
                )}
              >
          {selected.type === "text" ? (
            <>
              <div className="space-y-1">
                <Label>내용 (리치 텍스트)</Label>
                <BookTextRichEditor
                  widgetKey={selected.id}
                  html={getTextWidgetDisplayHtml(selected)}
                  onRichPatch={(p) =>
                    onChange(selected.id, { richHtml: p.richHtml, text: p.text })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="insp-fs">크기</Label>
                <Input
                  id="insp-fs"
                  type="number"
                  min={10}
                  max={120}
                  value={selected.fontSize}
                  onChange={(e) =>
                    onChange(selected.id, {
                      fontSize: num(e.target.value, selected.fontSize, 10, 120),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insp-fill">기본 글자색</Label>
                <p className="text-[11px] text-muted-foreground">
                  리치 텍스트에 색이 없는 구간·플레인 미리보기에 쓰입니다.
                </p>
                <p className="text-[11px] text-muted-foreground">자주 쓰는 색</p>
                <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/25 p-1">
                  {BOOK_HEX_COLOR_PRESETS.map((c) => {
                    const fillNorm = selected.fill.trim().replace(/\s/g, "").toLowerCase();
                    const active = fillNorm === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        aria-label={`기본 글자색 ${c}`}
                        aria-pressed={active}
                        className={cn(
                          "size-7 shrink-0 rounded-md border border-border shadow-sm ring-offset-background hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                          active && "ring-2 ring-primary ring-offset-2",
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => onChange(selected.id, { fill: c })}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="insp-fill"
                    type="color"
                    className="h-9 w-14 shrink-0 cursor-pointer px-1"
                    value={selected.fill.startsWith("#") ? selected.fill : "#111827"}
                    onChange={(e) => onChange(selected.id, { fill: e.target.value })}
                    aria-label="기본 글자색 직접 선택"
                  />
                  <span className="text-[11px] text-muted-foreground">팔레트로 직접 선택</span>
                </div>
              </div>
              <ElementOpacitySlider
                elementId={selected.id}
                opacity={selected.opacity}
                onChange={onChange}
              />
              <div className="space-y-1">
                <Label htmlFor="insp-tw">줄 너비</Label>
                <Input
                  id="insp-tw"
                  type="number"
                  min={80}
                  max={2000}
                  value={selected.width ?? 640}
                  onChange={(e) =>
                    onChange(selected.id, {
                      width: num(e.target.value, selected.width ?? 640, 80, 2000),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="insp-th">박스 높이</Label>
                <Input
                  id="insp-th"
                  type="number"
                  min={28}
                  max={4000}
                  value={Math.round(
                    selected.height ?? defaultTextWidgetBoxHeight(selected.fontSize),
                  )}
                  onChange={(e) =>
                    onChange(selected.id, {
                      height: num(
                        e.target.value,
                        selected.height ?? defaultTextWidgetBoxHeight(selected.fontSize),
                        28,
                        4000,
                      ),
                    })
                  }
                />
              </div>
              <ElementShapeChromeFields el={selected} onChange={onChange} />
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          ) : selected.type === "weather" ? (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                OpenWeatherMap(지오코딩·날씨·대기질)을 사용합니다. 서버에{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">OPENWEATHERMAP_API_KEY</code>가
                필요합니다.
              </p>
              <div className="space-y-1">
                <Label htmlFor="insp-weather-city">도시 / 지역</Label>
                <Input
                  id="insp-weather-city"
                  placeholder="비우면 서울 · 예: Seoul,KR, Busan,KR"
                  value={selected.cityQuery ?? ""}
                  maxLength={120}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange(selected.id, {
                      cityQuery: v.trim() === "" ? undefined : v,
                    });
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  검색어 뒤에 국가 코드를 붙이면 더 정확합니다.
                </p>
              </div>
              <div className="space-y-2">
                <Label>표시 항목</Label>
                <p className="text-[11px] text-muted-foreground">
                  날씨만 남기면 큰 기온 카드, 대기 항목만 켜면 대기질 전용 톤으로 바뀝니다.
                </p>
                <div className="flex flex-col gap-2">
                  {WEATHER_INSPECTOR_FIELDS.map(({ key, label }) => {
                    const disp = resolveBookWeatherDisplay(selected.weatherDisplay);
                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 text-sm leading-none"
                      >
                        <Checkbox
                          checked={disp[key]}
                          onCheckedChange={(c) => {
                            const on = c === true;
                            onChange(selected.id, {
                              weatherDisplay: patchWeatherDisplay(selected.weatherDisplay, key, on),
                            });
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <OptionalWidgetBackdropFields
                elementId={selected.id}
                value={selected.weatherBackground}
                field="weatherBackground"
                defaultRgba="rgba(14,165,233,0.88)"
                colorAriaLabel="날씨 카드 배경색"
                defaultHint="끄면 날씨/대기 테마 일러스트 배경을 씁니다."
                onChange={onChange}
              />
              <OptionalWidgetTextColorFields
                elementId={selected.id}
                value={selected.weatherTextColor}
                field="weatherTextColor"
                defaultHex="#ffffff"
                colorAriaLabel="날씨 위젯 글자색"
                defaultHint="끄면 배경 테마에 맞는 기본 글자색을 씁니다."
                onChange={onChange}
              />
              <ElementOpacitySlider
                elementId={selected.id}
                opacity={selected.opacity}
                onChange={onChange}
              />
              <ElementShapeChromeFields el={selected} onChange={onChange} />
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          ) : selected.type === "digitalClock" ? (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                브라우저 로컬 시간 기준입니다. 초 표시를 끄면 분이 바뀔 때만 갱신됩니다.
              </p>
              <div className="space-y-2">
                <Label>표시</Label>
                <div className="flex flex-col gap-2">
                  {DIGITAL_CLOCK_INSPECTOR_FIELDS.map(({ key, label }) => {
                    const disp = resolveBookDigitalClockDisplay(selected.clockDisplay);
                    const checked = disp[key];
                    return (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 text-sm leading-none"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            const on = c === true;
                            onChange(selected.id, {
                              clockDisplay: patchDigitalClockDisplay(selected.clockDisplay, key, on),
                            });
                          }}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <OptionalWidgetBackdropFields
                elementId={selected.id}
                value={selected.clockBackground}
                field="clockBackground"
                defaultRgba="rgba(15,23,42,0.92)"
                colorAriaLabel="시계 배경색"
                defaultHint="끄면 기본 그라데이션 배경을 씁니다."
                onChange={onChange}
              />
              <OptionalWidgetTextColorFields
                elementId={selected.id}
                value={selected.clockTextColor}
                field="clockTextColor"
                defaultHex="#ffffff"
                colorAriaLabel="디지털 시계 글자색"
                defaultHint="끄면 밝은 기본 글자색을 씁니다."
                onChange={onChange}
              />
              <ElementOpacitySlider
                elementId={selected.id}
                opacity={selected.opacity}
                onChange={onChange}
              />
              <ElementShapeChromeFields el={selected} onChange={onChange} />
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          ) : selected.type === "image" ? (
            <>
              <p className="text-xs text-muted-foreground break-all">이미지: {selected.src}</p>
              <MediaObjectFitFields
                elementId={selected.id}
                value={selected.objectFit}
                onChange={onChange}
              />
              <ElementOpacitySlider
                elementId={selected.id}
                opacity={selected.opacity}
                onChange={onChange}
              />
              <ElementShapeChromeFields el={selected} onChange={onChange} />
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground break-all">동영상: {selected.src}</p>
              {selected.posterSrc ? (
                <p className="text-xs text-muted-foreground break-all">포스터: {selected.posterSrc}</p>
              ) : null}
              <MediaObjectFitFields
                elementId={selected.id}
                value={selected.objectFit}
                onChange={onChange}
              />
              <ElementOpacitySlider
                elementId={selected.id}
                opacity={selected.opacity}
                onChange={onChange}
              />
              <ElementShapeChromeFields el={selected} onChange={onChange} />
              <PositionSizeFields el={selected} onChange={onChange} />
            </>
          )}

                {selected ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        onChange(selected.id, {
                          x: 0,
                          y: 0,
                          width: slideWidth,
                          height: slideHeight,
                        })
                      }
                    >
                      <Expand className="mr-1.5 size-3.5" aria-hidden />
                      슬라이드 전체(0,0)로 맞추기
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={onDelete}
                    >
                      <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                      위젯 삭제
                    </Button>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {mediaHint ? <p className="text-xs text-amber-600 dark:text-amber-400">{mediaHint}</p> : null}
        </div>
      </div>
    </Root>
  );
}

function PositionSizeFields({
  el,
  onChange,
}: {
  el: BookCanvasElement;
  onChange: (id: string, patch: Partial<BookCanvasElement>) => void;
}) {
  const rotDeg = Math.round(resolveBookElementRotation(el.rotation));
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="insp-x">X</Label>
        <Input
          id="insp-x"
          type="number"
          value={Math.round(el.x)}
          onChange={(e) => onChange(el.id, { x: num(e.target.value, el.x, 0, 4000) })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="insp-y">Y</Label>
        <Input
          id="insp-y"
          type="number"
          value={Math.round(el.y)}
          onChange={(e) => onChange(el.id, { y: num(e.target.value, el.y, 0, 4000) })}
        />
      </div>
      {el.type !== "text" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="insp-w">너비</Label>
            <Input
              id="insp-w"
              type="number"
              min={24}
              value={Math.round(el.width)}
              onChange={(e) =>
                onChange(el.id, { width: num(e.target.value, el.width, 24, 4000) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="insp-h">높이</Label>
            <Input
              id="insp-h"
              type="number"
              min={24}
              value={Math.round(el.height)}
              onChange={(e) =>
                onChange(el.id, { height: num(e.target.value, el.height, 24, 4000) })
              }
            />
          </div>
        </>
      ) : (
        <>
          <div className="col-span-2 text-xs text-muted-foreground">
            텍스트 박스 크기는 캔버스에서 모서리를 드래그하거나 &quot;줄 너비&quot;로 조절합니다.
          </div>
        </>
      )}
      <div className="col-span-2 space-y-1">
        <Label htmlFor="insp-rot">회전 (°)</Label>
        <Input
          id="insp-rot"
          type="number"
          min={-360}
          max={360}
          step={1}
          value={rotDeg}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            const clamped = Math.min(360, Math.max(-360, Math.round(n)));
            onChange(el.id, {
              rotation: clamped === 0 ? undefined : clamped,
            });
          }}
        />
        <p className="text-[11px] text-muted-foreground">
          시계 방향이 양수입니다. 변형 핸들로도 돌릴 수 있습니다.
        </p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudOff,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { fetchWeatherCurrent, type SeoulWeatherPayload } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  bookElementOverlayTopLeftFromPivot,
  bookElementPivotKonva,
  resolveBookElementOpacity,
  resolveBookElementRotation,
  resolveBookWeatherDisplay,
  type BookCanvasElement,
  type BookWeatherDisplayResolved,
} from "@/lib/book-canvas";
import type { BookTextOverlayLiveFrame } from "@/components/books/BookTextWidgetOverlay";

type Props = {
  el: Extract<BookCanvasElement, { type: "weather" }>;
  scale: number;
  mode: "edit" | "view";
  isSelected: boolean;
  liveFrame?: BookTextOverlayLiveFrame | null;
};

type VisualKind =
  | "clear-day"
  | "clear-night"
  | "cloudy-day"
  | "cloudy-night"
  | "rain"
  | "storm"
  | "snow"
  | "mist";

type LayoutVariant = "standard" | "minimal" | "air-only" | "split-air";

function visualKindFromOwmIcon(icon: string): VisualKind {
  const code = icon.slice(0, 2);
  const night = icon.endsWith("n");
  if (code === "01") return night ? "clear-night" : "clear-day";
  if (code === "13") return "snow";
  if (code === "09" || code === "10") return "rain";
  if (code === "11") return "storm";
  if (code === "50") return "mist";
  if (night) return "cloudy-night";
  return "cloudy-day";
}

/** 슬라이드에 표시되는 동안 주기 갱신(같은 도시 쿼리 키는 하나로 합쳐짐). 탭이 백그라운드면 갱신 안 함. */
const WEATHER_REFETCH_INTERVAL_MS = 5 * 60_000;

const WEATHER_LINE_ICONS: Record<VisualKind, LucideIcon> = {
  "clear-day": Sun,
  "clear-night": Moon,
  "cloudy-day": CloudSun,
  "cloudy-night": CloudMoon,
  rain: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
  mist: CloudFog,
};

function useTickNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatPmShort(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v)}`;
}

function pickLayoutVariant(d: BookWeatherDisplayResolved): LayoutVariant {
  const weatherCore =
    d.temp || d.feelsLike || d.description || d.icon || d.humidity || d.wind;
  const nAir = (d.pm25 ? 1 : 0) + (d.pm10 ? 1 : 0) + (d.aqi ? 1 : 0);
  if (!weatherCore && nAir > 0) return "air-only";
  if (weatherCore && nAir >= 2) return "split-air";
  if (weatherCore && nAir === 0 && !d.clock && !d.date) return "minimal";
  return "standard";
}

function CardBackdrop({ kind }: { kind: VisualKind }) {
  switch (kind) {
    case "clear-day":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #f26d5c 0%, #f59e0b 42%, #fbbf24 88%)",
            }}
          />
          <div
            className="absolute -right-[12%] -top-[18%] size-[65%] rounded-full bg-yellow-200/35 blur-2xl"
            aria-hidden
          />
          <div
            className="absolute -left-[8%] bottom-[-20%] size-[50%] rounded-full bg-orange-300/25 blur-3xl"
            aria-hidden
          />
        </>
      );
    case "clear-night":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(165deg, #0f172a 0%, #1e1b4b 45%, #172554 100%)",
            }}
          />
          {[
            [12, 8],
            [28, 18],
            [72, 12],
            [88, 22],
            [18, 38],
            [55, 28],
            [82, 42],
            [40, 48],
          ].map(([l, t], i) => (
            <span
              key={i}
              className="absolute size-0.5 rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.8)]"
              style={{ left: `${l}%`, top: `${t}%` }}
              aria-hidden
            />
          ))}
          <div
            className="absolute -right-[6%] top-[8%] size-[38%] rounded-full border-[0.18em] border-amber-200/90 border-r-transparent border-b-transparent border-l-transparent rotate-[-25deg]"
            style={{ boxShadow: "0 0 0 0.08em rgba(253,230,138,0.15)" }}
            aria-hidden
          />
        </>
      );
    case "cloudy-day":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(145deg, #64748b 0%, #3b82f6 55%, #1d4ed8 100%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-t from-slate-900/35 to-transparent"
            aria-hidden
          />
          <div
            className="absolute -bottom-[8%] left-[-5%] right-[-5%] h-[38%] rounded-[100%] bg-slate-800/25 blur-sm"
            aria-hidden
          />
        </>
      );
    case "cloudy-night":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(155deg, #1e293b 0%, #312e81 50%, #1e3a5f 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[40%] bg-linear-to-t from-black/40 to-transparent" aria-hidden />
        </>
      );
    case "rain":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(160deg, #475569 0%, #1e40af 40%, #0f172a 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[35%] bg-linear-to-t from-slate-950/50 to-transparent" aria-hidden />
        </>
      );
    case "storm":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(165deg, #334155 0%, #3730a3 35%, #0f172a 100%)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(250,204,21,0.12),transparent_50%)]" aria-hidden />
        </>
      );
    case "snow":
      return (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(145deg, #bae6fd 0%, #e0f2fe 50%, #7dd3fc 100%)",
            }}
          />
          {[
            [10, 15, 0.45],
            [78, 22, 0.35],
            [45, 8, 0.5],
            [88, 55, 0.3],
            [22, 62, 0.4],
            [65, 70, 0.35],
          ].map(([l, t, op], i) => (
            <span
              key={i}
              className="pointer-events-none absolute text-white"
              style={{
                left: `${l}%`,
                top: `${t}%`,
                opacity: op,
                fontSize: "0.7em",
                textShadow: "0 0 6px rgba(255,255,255,0.9)",
              }}
              aria-hidden
            >
              ✦
            </span>
          ))}
        </>
      );
    case "mist":
      return (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, #94a3b8 0%, #64748b 55%, #475569 100%)",
          }}
        />
      );
    default:
      return <div className="absolute inset-0 bg-linear-to-br from-sky-500 to-indigo-700" aria-hidden />;
  }
}

/** 대기질 전용 카드 배경 (날씨 아이콘 테마와 별도) */
function AirQualityBackdrop({ aqiLevel }: { aqiLevel: number | null }) {
  const tier = aqiLevel == null ? 0 : Math.min(5, Math.max(1, aqiLevel));
  const hue =
    tier <= 1
      ? "from-emerald-900 via-teal-900 to-slate-900"
      : tier === 2
        ? "from-slate-800 via-cyan-950 to-slate-950"
        : tier === 3
          ? "from-amber-950 via-slate-900 to-slate-950"
          : "from-rose-950 via-slate-900 to-slate-950";
  return (
    <div className={cn("absolute inset-0 bg-linear-to-br", hue)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_0%,rgba(52,211,153,0.15),transparent_55%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/35 to-transparent" />
    </div>
  );
}

function aqiAccentClass(aqiLevel: number | null): string {
  const t = aqiLevel == null ? 0 : Math.min(5, Math.max(1, aqiLevel));
  if (t <= 1) return "text-emerald-200";
  if (t === 2) return "text-cyan-200";
  if (t === 3) return "text-amber-200";
  return "text-rose-200";
}

export function BookWeatherWidgetOverlay({ el, scale, mode, isSelected, liveFrame }: Props) {
  const qNorm = el.cityQuery?.trim() ?? "";
  const disp = resolveBookWeatherDisplay(el.weatherDisplay);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["weather", "current", qNorm],
    queryFn: () => fetchWeatherCurrent(qNorm || null),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    refetchInterval: WEATHER_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const now = useTickNow();
  const timeStr = useMemo(
    () =>
      now.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [now],
  );
  const dateStr = useMemo(
    () =>
      now.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }),
    [now],
  );

  const w = el.width;
  const h = el.height;
  const o = resolveBookElementOpacity(el.opacity);
  const rot = resolveBookElementRotation(el.rotation);
  const pivot = bookElementPivotKonva({ x: el.x, y: el.y, width: w, height: h, rotation: el.rotation });
  const layoutOrigin = bookElementOverlayTopLeftFromPivot(pivot, w, h);
  const fx = liveFrame?.x ?? layoutOrigin.x;
  const fy = liveFrame?.y ?? layoutOrigin.y;
  const fw = liveFrame?.width ?? w;
  const fh = liveFrame?.height ?? h;
  const fRot = liveFrame != null ? liveFrame.rotation : rot;

  const boxH = fh * scale;
  const condSize = Math.max(14, Math.min(26, boxH * 0.14));
  const tempSize = Math.max(26, Math.min(52, boxH * 0.36));
  const tempSizeMinimal = Math.max(34, Math.min(64, boxH * 0.48));
  const clockSize = Math.max(16, Math.min(30, boxH * 0.2));
  const bodySize = Math.max(9, Math.min(13, boxH * 0.085));
  const aqiHuge = Math.max(28, Math.min(48, boxH * 0.34));

  const errMsg = error instanceof Error ? error.message : "불러오지 못했습니다.";

  const kind = data ? visualKindFromOwmIcon(data.icon || "02d") : "cloudy-day";
  const LineIcon = WEATHER_LINE_ICONS[kind];
  const variant = data ? pickLayoutVariant(disp) : "standard";
  const snowLike = kind === "snow" && variant !== "air-only";
  const textMain = snowLike ? "text-slate-800" : "text-white";
  const textMuted = snowLike ? "text-slate-700/85" : "text-white/85";
  const textFaint = snowLike ? "text-slate-600/90" : "text-white/75";

  const showTimeCol = disp.clock || disp.date;
  const hasAir = disp.pm25 || disp.pm10 || disp.aqi;

  const ringAccent =
    variant === "split-air" ? "ring-2 ring-emerald-400/40" : "ring-1 ring-black/10";

  const renderAirBlock = (payload: SeoulWeatherPayload, opts: { accent?: boolean; compact?: boolean }) => (
    <div
      className={cn(
        "w-full min-w-0 space-y-0.5",
        opts.accent && "rounded-md border-l-[3px] border-emerald-400/85 pl-2",
        opts.compact && "space-y-0",
      )}
    >
      {disp.pm10 || disp.pm25 ? (
        <div className={cn("leading-snug", textFaint)} style={{ fontSize: bodySize * 0.88 }}>
          {disp.pm10 ? <>미세 PM10 {formatPmShort(payload.pm10)}</> : null}
          {disp.pm10 && disp.pm25 ? " · " : null}
          {disp.pm25 ? <>초미세 PM2.5 {formatPmShort(payload.pm25)}</> : null}
        </div>
      ) : null}
      {disp.aqi ? (
        <div className={cn("font-medium", textMuted)} style={{ fontSize: bodySize * 0.88 }}>
          대기 {payload.aqiLabel ?? "—"}
          {payload.aqiLevel != null ? ` (${payload.aqiLevel}/5)` : ""}
        </div>
      ) : null}
    </div>
  );

  const renderSecondaryWeather = (payload: SeoulWeatherPayload) => {
    const parts: string[] = [];
    if (disp.feelsLike) parts.push(`체감 ${Math.round(payload.feelsLikeC)}°`);
    if (disp.humidity) parts.push(`습도 ${Math.round(payload.humidity)}%`);
    if (disp.wind) parts.push(`바람 ${payload.windMps.toFixed(1)}m/s`);
    if (parts.length === 0) return null;
    return (
      <div className={cn("opacity-80", textFaint)} style={{ fontSize: bodySize * 0.82 }}>
        {parts.join(" · ")}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute overflow-hidden rounded-2xl shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)]",
        ringAccent,
        isSelected && mode === "edit" && "ring-2 ring-primary ring-offset-0",
      )}
      style={{
        left: fx * scale,
        top: fy * scale,
        width: fw * scale,
        height: fh * scale,
        opacity: o,
        transform: fRot !== 0 ? `rotate(${fRot}deg)` : undefined,
        transformOrigin: "center center",
        borderRadius: Math.max(12, fh * scale * 0.09),
      }}
    >
      {isPending ? (
        <div className="flex h-full min-h-0 items-center justify-center gap-2 bg-linear-to-br from-slate-700 to-slate-900 px-3 text-white/90">
          <Loader2
            className="shrink-0 animate-spin opacity-90"
            style={{ width: condSize * 1.1, height: condSize * 1.1 }}
            aria-hidden
          />
          <span className="font-medium" style={{ fontSize: bodySize }}>
            불러오는 중…
          </span>
        </div>
      ) : isError ? (
        <div className="flex h-full min-h-0 flex-col items-center justify-center gap-1 bg-linear-to-br from-amber-900/95 to-slate-900 px-2 text-center text-amber-50">
          <CloudOff className="size-8 shrink-0 opacity-90" aria-hidden />
          <span className="text-[0.8em] leading-snug">{errMsg}</span>
        </div>
      ) : data ? (
        <div className="relative h-full min-h-0 w-full text-white">
          {variant === "air-only" ? (
            <AirQualityBackdrop aqiLevel={data.aqiLevel} />
          ) : (
            <CardBackdrop kind={kind} />
          )}

          {variant === "air-only" ? (
            <div
              className={cn(
                "relative z-1 flex h-full min-h-0 flex-col justify-between px-[6%] py-[7%]",
                "text-white",
              )}
            >
              <div className="min-w-0">
                <div className={cn("font-semibold opacity-90")} style={{ fontSize: bodySize * 1.05 }}>
                  {data.locationLabel}
                </div>
                <div className="mt-1 text-[0.75em] font-medium uppercase tracking-wider text-white/55">
                  지역 대기질
                </div>
              </div>
              <div className="flex flex-1 flex-col justify-center gap-1">
                {disp.aqi ? (
                  <div className={cn("font-bold tabular-nums", aqiAccentClass(data.aqiLevel))} style={{ fontSize: aqiHuge }}>
                    {data.aqiLabel ?? "—"}
                    {data.aqiLevel != null ? (
                      <span className="text-[0.45em] font-semibold text-white/70"> · {data.aqiLevel}/5</span>
                    ) : null}
                  </div>
                ) : null}
                {renderAirBlock(data, { compact: true })}
              </div>
            </div>
          ) : variant === "minimal" ? (
            <div
              className={cn(
                "relative z-1 flex h-full min-h-0 flex-col items-center justify-center gap-1 px-[6%] py-[6%]",
                textMain,
              )}
            >
              {disp.icon ? (
                <LineIcon
                  className={cn("shrink-0 stroke-[2.25]", snowLike ? "text-slate-800" : "text-white")}
                  style={{ width: condSize * 1.5, height: condSize * 1.5 }}
                  aria-hidden
                />
              ) : null}
              {disp.description ? (
                <span className={cn("text-center font-medium capitalize", textMuted)} style={{ fontSize: bodySize }}>
                  {data.description || "—"}
                </span>
              ) : null}
              {disp.temp ? (
                <div className="flex items-end gap-1">
                  <span
                    className={cn("tabular-nums font-bold tracking-tight drop-shadow-md", snowLike ? "text-slate-900" : "text-white")}
                    style={{ fontSize: tempSizeMinimal, lineHeight: 0.95 }}
                  >
                    {Math.round(data.tempC)}
                  </span>
                  <span className={cn("pb-[0.12em] font-semibold opacity-90", textMuted)} style={{ fontSize: tempSizeMinimal * 0.32 }}>
                    °C
                  </span>
                </div>
              ) : null}
              {renderSecondaryWeather(data)}
              <div className={cn("mt-auto font-semibold", textFaint)} style={{ fontSize: bodySize * 0.92 }}>
                {data.locationLabel}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "relative z-1 grid h-full min-h-0 min-w-0 gap-x-2 px-[5%] py-[6%]",
                showTimeCol ? "grid-cols-[minmax(0,1.12fr)_minmax(0,0.98fr)]" : "grid-cols-1",
                textMain,
              )}
            >
              <div className="flex min-h-0 min-w-0 flex-col justify-between gap-1">
                {disp.description || disp.icon ? (
                  <div className="flex min-w-0 items-center gap-2">
                    {disp.icon ? (
                      <LineIcon
                        className={cn("shrink-0 stroke-[2.25]", snowLike ? "text-slate-800" : "text-white")}
                        style={{ width: condSize * 1.35, height: condSize * 1.35 }}
                        aria-hidden
                      />
                    ) : null}
                    {disp.description ? (
                      <span
                        className={cn("min-w-0 truncate font-medium capitalize leading-tight drop-shadow-sm", textMuted)}
                        style={{ fontSize: bodySize * 1.05 }}
                        title={data.description}
                      >
                        {data.description || "—"}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-auto space-y-0.5">
                  {disp.temp ? (
                    <div className="flex items-end gap-1">
                      <span
                        className={cn("tabular-nums font-bold tracking-tight drop-shadow-md", snowLike ? "text-slate-900" : "text-white")}
                        style={{ fontSize: variant === "split-air" ? tempSize * 0.92 : tempSize, lineHeight: 0.95 }}
                      >
                        {Math.round(data.tempC)}
                      </span>
                      <span className={cn("pb-[0.15em] font-semibold opacity-90", textMuted)} style={{ fontSize: tempSize * 0.38 }}>
                        °C
                      </span>
                    </div>
                  ) : null}
                  {variant === "split-air" && hasAir ? (
                    <div className="pt-1">{renderAirBlock(data, { accent: true })}</div>
                  ) : null}
                </div>
              </div>

              {showTimeCol ? (
                <div className="flex min-h-0 min-w-0 flex-col items-end justify-between text-end">
                  <div>
                    {disp.clock ? (
                      <div
                        className={cn("font-bold tabular-nums tracking-tight drop-shadow-md", textMain)}
                        style={{ fontSize: clockSize, lineHeight: 1 }}
                      >
                        {timeStr}
                      </div>
                    ) : null}
                    {disp.date ? (
                      <div className={cn("mt-0.5 font-medium opacity-90", textFaint)} style={{ fontSize: bodySize * 0.92 }}>
                        {dateStr}
                      </div>
                    ) : null}
                  </div>
                  <div className="w-full min-w-0 space-y-0.5">
                    <div className={cn("font-semibold drop-shadow-sm", textMain)} style={{ fontSize: bodySize * 1.05 }}>
                      {data.locationLabel}
                    </div>
                    {variant === "standard" && hasAir ? renderAirBlock(data, {}) : null}
                    {variant === "standard" || variant === "split-air" ? renderSecondaryWeather(data) : null}
                  </div>
                </div>
              ) : (
                <div className="col-span-full flex min-h-0 flex-col gap-1 border-t border-white/15 pt-2">
                  <div className={cn("font-semibold", textMain)} style={{ fontSize: bodySize * 1.02 }}>
                    {data.locationLabel}
                  </div>
                  {hasAir && variant !== "split-air" ? renderAirBlock(data, {}) : null}
                  {renderSecondaryWeather(data)}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

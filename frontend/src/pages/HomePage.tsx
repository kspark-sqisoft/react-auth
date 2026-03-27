import { lazy, Suspense } from "react";
import { HomeDirtyFigmaOverlay } from "@/components/home/HomeDirtyFigmaOverlay";

const HomeHero3D = lazy(() =>
  import("@/components/home/HomeHero3D").then((m) => ({ default: m.HomeHero3D })),
);

/**
 * 홈: zxpv7 `App.js` 씬 + `DirtyFigmaExport` 타이포 레이어. 그라데이션은 원본 `styles.css`에 맞춤.
 */
export function HomePage() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,#e6eaf5_0%,#f6f6f6_80%)] dark:bg-[linear-gradient(180deg,oklch(0.22_0_0)_0%,oklch(0.145_0_0)_80%)]">
      <Suspense
        fallback={<div className="min-h-0 flex-1 animate-pulse bg-muted/25" aria-hidden />}
      >
        <HomeHero3D className="relative z-0 min-h-0 flex-1" />
      </Suspense>
      <HomeDirtyFigmaOverlay />
    </div>
  );
}

import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/stores/auth-store";
import { appLog } from "@/lib/app-log";
import { Spinner } from "@/components/ui/spinner";

/**
 * `hydrate` 완료 후에만 판단합니다.
 * 비로그인이면 `location`을 넘겨 로그인 뒤 원래 경로로 돌아갈 수 있게 합니다.
 */
export function ProtectedRoute() {
  const { user, isReady } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isReady && !user) {
      appLog("route", "보호 경로 — 비로그인, 로그인으로 이동", { pathname: location.pathname });
    }
  }, [isReady, user, location.pathname]);

  if (!isReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

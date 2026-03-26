import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { appLog } from "@/lib/app-log";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth-store";
import "./index.css";
import App from "./App.tsx";

/**
 * 앱이 처음 켜질 때 한 번 `hydrate()`를 호출합니다.
 *
 * - `hydrate`는 Zustand `auth-store` 안의 함수 이름입니다(일반 React 용어가 아님).
 * - 역할: 새로고침 후에도 “로그인 유지”를 위해, 저장소·쿠키 기준으로 `user`를 채우고 `isReady`를 true로 만듦.
 * - `void ... .then(...)` : await 없이 백그라운드로 돌리고, 동시에 아래 `createRoot().render()`로 UI는 바로 그림.
 *   (ProtectedRoute 등은 `isReady`가 false인 동안 스피너를 보여 주다가, hydrate 끝나면 본 화면으로 전환)
 */
void useAuthStore.getState().hydrate().then(() => {
  appLog("bootstrap", "hydrate 완료 (라우트 렌더 가능)");
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* 클라이언트 사이드 라우팅; basename이 필요하면 여기서 지정 */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

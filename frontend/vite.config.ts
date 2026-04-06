import type { IncomingMessage } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 주소창에 `http://localhost:5173/posts`처럼 직접 치면 브라우저는 `Accept: text/html`로 문서를 요청합니다.
 * 그대로 `/posts`를 API 프록시로 넘기면 Nest가 JSON만 내려서 화면에 글 목록 JSON이 보입니다.
 * HTML(문서) 요청일 때만 SPA의 `index.html`을 주고, XHR/fetch(`Accept`에 보통 `text/html` 없음)는 계속 백엔드로 보냅니다.
 */
function spaHtmlBypass(req: IncomingMessage) {
  const accept = req.headers.accept ?? "";
  if (accept.includes("text/html")) {
    return "/index.html";
  }
}

/** Docker dev: `VITE_API_PROXY_TARGET=http://backend:3000` (compose에서 설정) */
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET?.trim() || "http://localhost:3000";

/** Windows 등에서 호스트 ↔ 컨테이너 볼륨 마운트 시 inotify가 안 먹는 경우 폴링으로 HMR 복구 */
const dockerDev = process.env.DOCKER_DEV === "true";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    ...(dockerDev
      ? { watch: { usePolling: true, interval: 300 } }
      : {}),
    proxy: {
      "/auth": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/users": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/posts": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/books": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/weather": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/news": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/cats": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/uploads": {
        target: apiProxyTarget,
        changeOrigin: true,
        bypass: spaHtmlBypass,
      },
      "/socket.io": {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

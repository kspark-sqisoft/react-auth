/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 백엔드 HTTP 오리진 (끝 슬래시 없음). 예: http://localhost:3000 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

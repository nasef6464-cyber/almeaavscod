/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
  __ALMEAA_APP_VERSION__?: string;
  __ALMEAA_API_BASE_URL__?: string;
  __ALMEAA_PERF_DEBUG__?: boolean;
  __ALMEAA_APP_STARTED_AT__?: number;
}

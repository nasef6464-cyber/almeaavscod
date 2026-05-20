import * as Sentry from "@sentry/react";

const dsn = String(import.meta.env.VITE_SENTRY_DSN || "").trim();
const environment = String(import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || "development");
const tracesSampleRateRaw = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0);
const tracesSampleRate = Number.isFinite(tracesSampleRateRaw)
  ? Math.max(0, Math.min(1, tracesSampleRateRaw))
  : 0;

let initialized = false;

export const isFrontendSentryEnabled = () => Boolean(dsn);

export const initFrontendSentry = () => {
  if (initialized || !dsn) return;

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
  });

  initialized = true;
};


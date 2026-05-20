import * as Sentry from "@sentry/react";

export function initFrontendSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || "";
  if (!dsn) {
    console.log("Sentry DSN not configured — skipping Sentry initialization");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0,
  });

  console.log("Frontend Sentry initialized");
}

export { Sentry };

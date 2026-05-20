import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";

export function initSentry() {
  if (!env.SENTRY_DSN) {
    console.log("Sentry DSN not configured — skipping Sentry initialization");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });

  console.log("Sentry initialized");
}

export function isSentryEnabled(): boolean {
  return !!env.SENTRY_DSN;
}

export function captureSentryMessage(message: string, level: Sentry.SeverityLevel = "info") {
  if (isSentryEnabled()) {
    Sentry.captureMessage(message, level);
  }
}

export { Sentry };

import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";

let initialized = false;

const resolveSampleRate = () => {
  const rate = Number(env.SENTRY_TRACES_SAMPLE_RATE || 0);
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(1, rate));
};

export const isSentryEnabled = () => Boolean(String(env.SENTRY_DSN || "").trim());

export function initSentry() {
  if (initialized || !isSentryEnabled()) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
    tracesSampleRate: resolveSampleRate(),
  });

  initialized = true;
}

export function captureSentryException(error: unknown, context?: Record<string, unknown>) {
  if (!isSentryEnabled()) return null;

  return Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value as any);
      }
    }
    return Sentry.captureException(error);
  });
}

export function captureSentryMessage(message: string, context?: Record<string, unknown>) {
  if (!isSentryEnabled()) return null;

  return Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value as any);
      }
    }
    return Sentry.captureMessage(message, "error");
  });
}

import { API_BASE_URL } from './api';

type ClientEventSeverity = 'info' | 'warning' | 'error';
type ClientEventSource =
  | 'app'
  | 'error-boundary'
  | 'unhandled-error'
  | 'unhandled-rejection'
  | 'video-player'
  | 'api'
  | 'manual';

type ClientTelemetryPayload = {
  severity?: ClientEventSeverity;
  source?: ClientEventSource;
  message: string;
  stack?: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

const SESSION_STORAGE_KEY = 'the-hundred-auth-profile';
const COOKIE_FIRST_AUTH_ENABLED =
  (import.meta as ImportMeta & { env?: Record<string, string | boolean> }).env?.VITE_AUTH_COOKIE_FIRST !== 'false';
const MAX_MESSAGE_LENGTH = 800;
const MAX_STACK_LENGTH = 3000;
const sentRecently = new Map<string, number>();

const truncate = (value: unknown, maxLength: number) => String(value || '').slice(0, maxLength);

const getStoredSessionToken = (): string | null => {
  if (COOKIE_FIRST_AUTH_ENABLED) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token || null;
  } catch {
    return null;
  }
};

const serializeReason = (reason: unknown) => {
  if (reason instanceof Error) {
    return {
      message: reason.message,
      stack: reason.stack,
    };
  }

  if (typeof reason === 'string') {
    return { message: reason };
  }

  try {
    return { message: JSON.stringify(reason) };
  } catch {
    return { message: 'Unknown client error' };
  }
};

export const reportClientEvent = async (payload: ClientTelemetryPayload) => {
  const message = truncate(payload.message, MAX_MESSAGE_LENGTH).trim();
  if (!message) return;

  const path = payload.path || `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const dedupeKey = `${payload.source || 'app'}:${message}:${path}`;
  const now = Date.now();
  const lastSentAt = sentRecently.get(dedupeKey) || 0;

  if (now - lastSentAt < 30_000) {
    return;
  }

  sentRecently.set(dedupeKey, now);

  const body = {
    severity: payload.severity || 'error',
    source: payload.source || 'app',
    message,
    stack: truncate(payload.stack, MAX_STACK_LENGTH),
    path: truncate(path, 500),
    appVersion: window.__ALMEAA_APP_VERSION__ || '',
    userAgent: truncate(navigator.userAgent, 500),
    metadata: payload.metadata || {},
  };

  try {
    const token = getStoredSessionToken();
    await fetch(`${API_BASE_URL}/operations/client-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Telemetry must never break the user journey.
  }
};

export const installGlobalClientTelemetry = () => {
  const onError = (event: ErrorEvent) => {
    void reportClientEvent({
      source: 'unhandled-error',
      severity: 'error',
      message: event.message || 'Unhandled browser error',
      stack: event.error?.stack,
      metadata: {
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const serialized = serializeReason(event.reason);
    void reportClientEvent({
      source: 'unhandled-rejection',
      severity: 'error',
      message: serialized.message || 'Unhandled promise rejection',
      stack: serialized.stack,
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
};

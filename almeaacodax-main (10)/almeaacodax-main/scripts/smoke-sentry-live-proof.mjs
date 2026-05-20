const API_BASE_URL = String(process.env.API_BASE_URL || "https://almeaacodax-k2ux.onrender.com/api").trim();
const SMOKE_ADMIN_TOKEN = String(process.env.SMOKE_ADMIN_TOKEN || "").trim();
const CSRF_COOKIE_NAME = "almeaa_csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

if (!SMOKE_ADMIN_TOKEN) {
  console.error("Missing SMOKE_ADMIN_TOKEN");
  process.exit(1);
}

const extractCookieValue = (setCookieHeader, cookieName) => {
  const cookieMatch = String(setCookieHeader || "").match(new RegExp(`${cookieName}=([^;]+)`));
  return String(cookieMatch?.[1] || "").trim();
};

const csrfResponse = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/auth/csrf-token`, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${SMOKE_ADMIN_TOKEN}`,
    Accept: "application/json",
  },
});

const csrfRaw = await csrfResponse.text();
let csrfPayload = null;
try {
  csrfPayload = JSON.parse(csrfRaw);
} catch {
  csrfPayload = { raw: csrfRaw };
}

const csrfToken =
  String(csrfPayload?.csrfToken || "").trim() ||
  extractCookieValue(csrfResponse.headers.get("set-cookie"), CSRF_COOKIE_NAME);
const csrfCookie = extractCookieValue(csrfResponse.headers.get("set-cookie"), CSRF_COOKIE_NAME);

if (!csrfResponse.ok || !csrfToken || !csrfCookie) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        step: "csrf",
        status: csrfResponse.status,
        csrfTokenPresent: Boolean(csrfToken),
        csrfCookiePresent: Boolean(csrfCookie),
        payload: csrfPayload,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const sentryTestUrl = `${API_BASE_URL.replace(/\/$/, "")}/operations/sentry/test-event`;

const response = await fetch(sentryTestUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SMOKE_ADMIN_TOKEN}`,
    "Content-Type": "application/json",
    [CSRF_HEADER_NAME]: csrfToken,
    Cookie: `${CSRF_COOKIE_NAME}=${csrfCookie}`,
  },
  body: JSON.stringify({ source: "smoke-sentry-live-proof" }),
});

const text = await response.text();
let payload = null;
try {
  payload = JSON.parse(text);
} catch {
  payload = { raw: text };
}

if (response.status !== 202) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        step: "request",
        status: response.status,
        payload,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

if (!payload?.eventId) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        step: "event_id",
        message: "Response did not include eventId",
        payload,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      status: response.status,
      eventId: payload.eventId,
      message: "Sentry live proof emitted",
      endpoint: sentryTestUrl,
    },
    null,
    2,
  ),
);

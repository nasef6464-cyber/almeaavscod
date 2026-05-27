const API_BASE = String(process.env.SMOKE_API_BASE_URL || "https://almeaavscod.onrender.com/api").replace(/\/$/, "");
const ADMIN_EMAIL = String(process.env.SMOKE_ADMIN_EMAIL || process.env.GOLIVE_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim();
const ADMIN_PASSWORD = String(process.env.SMOKE_ADMIN_PASSWORD || process.env.GOLIVE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "").trim();
const AUTH_COOKIE_NAME = "almeaa_access_token";
const CSRF_COOKIE_NAME = "almeaa_csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Missing admin credentials. Set one of: SMOKE_ADMIN_EMAIL/SMOKE_ADMIN_PASSWORD, GOLIVE_ADMIN_EMAIL/GOLIVE_ADMIN_PASSWORD, or ADMIN_EMAIL/ADMIN_PASSWORD.",
  );
  process.exit(1);
}

const extractCookieValue = (setCookieHeader, cookieName) => {
  const cookieMatch = String(setCookieHeader || "").match(new RegExp(`${cookieName}=([^;]+)`));
  return String(cookieMatch?.[1] || "").trim();
};

const csrfResponse = await fetch(`${API_BASE}/auth/csrf-token`, {
  method: "GET",
  headers: {
    Accept: "application/json",
  },
});

const csrfRawBody = await csrfResponse.text();
let csrfPayload = null;
try {
  csrfPayload = JSON.parse(csrfRawBody);
} catch {
  csrfPayload = null;
}

const csrfHeader = response => response.headers.get("set-cookie") || "";
const csrfCookie = extractCookieValue(csrfHeader(csrfResponse), CSRF_COOKIE_NAME);
const csrfToken = String(csrfPayload?.csrfToken || csrfCookie).trim();

if (!csrfResponse.ok || !csrfCookie || !csrfToken) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        step: "csrf",
        status: csrfResponse.status,
        csrfCookiePresent: Boolean(csrfCookie),
        csrfTokenPresent: Boolean(csrfToken),
        body: csrfPayload || csrfRawBody,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const response = await fetch(`${API_BASE}/auth/login`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    [CSRF_HEADER_NAME]: csrfToken,
    Cookie: `${CSRF_COOKIE_NAME}=${csrfCookie}`,
  },
  body: JSON.stringify({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  }),
});

const rawBody = await response.text();
let payload = null;
try {
  payload = JSON.parse(rawBody);
} catch {
  payload = null;
}

if (!response.ok) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        step: "login",
        status: response.status,
        body: payload || rawBody,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const bodyToken = String(payload?.token || "").trim();
if (bodyToken) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        source: "json",
        token: bodyToken,
        exportCommand: `setx SMOKE_ADMIN_TOKEN "${bodyToken}"`,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const cookieToken = extractCookieValue(response.headers.get("set-cookie"), AUTH_COOKIE_NAME);

if (cookieToken) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        source: "cookie",
        token: cookieToken,
        exportCommand: `setx SMOKE_ADMIN_TOKEN "${cookieToken}"`,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.error(
  JSON.stringify(
    {
      ok: false,
      step: "extract_token",
      message: "Login succeeded but no token was found in JSON response or Set-Cookie header.",
      hints: [
        "Check whether the production proxy strips Set-Cookie from this client context.",
        "As a fallback, log in from the browser and copy the almeaa_access_token cookie from DevTools > Application > Cookies.",
      ],
    },
    null,
    2,
  ),
);
process.exit(1);

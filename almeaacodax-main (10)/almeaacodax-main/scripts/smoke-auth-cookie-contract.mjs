import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [cookieSource, authRoutesSource, authMiddlewareSource, apiSource, authContextSource] = await Promise.all([
  read("server/src/utils/authCookie.ts"),
  read("server/src/routes/auth.routes.ts"),
  read("server/src/middleware/auth.ts"),
  read("services/api.ts"),
  read("contexts/AuthContext.tsx"),
]);

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", details: error instanceof Error ? error.message : String(error) });
  }
}

function assertIncludes(source, fragment, message) {
  if (!source.includes(fragment)) {
    throw new Error(message || `Missing fragment: ${fragment}`);
  }
}

check("auth cookie is HttpOnly and production secure", () => {
  assertIncludes(cookieSource, 'AUTH_COOKIE_NAME = "almeaa_access_token"');
  assertIncludes(cookieSource, "httpOnly: true");
  assertIncludes(cookieSource, 'sameSite: env.NODE_ENV === "production" ? "none" : "lax"');
  assertIncludes(cookieSource, 'secure: env.NODE_ENV === "production"');
  assertIncludes(cookieSource, "setAuthCookie");
  assertIncludes(cookieSource, "clearAuthCookie");
});

check("login and register issue the HttpOnly cookie", () => {
  const setCookieCalls = authRoutesSource.match(/setAuthCookie\(res, token\)/g) || [];
  if (setCookieCalls.length < 2) {
    throw new Error("Expected setAuthCookie on both register and login");
  }
});

check("logout clears the server cookie", () => {
  assertIncludes(authRoutesSource, '"/logout"');
  assertIncludes(authRoutesSource, "clearAuthCookie(res)");
  assertIncludes(authRoutesSource, "StatusCodes.NO_CONTENT");
});

check("auth middleware accepts bearer token or cookie token", () => {
  assertIncludes(authMiddlewareSource, "AUTH_COOKIE_NAME");
  assertIncludes(authMiddlewareSource, "bearerToken || cookieToken");
  assertIncludes(authMiddlewareSource, "req.cookies");
});

check("frontend sends credentials and clears client profile on logout (cookie-first)", () => {
  assertIncludes(apiSource, 'credentials: "include"');
  assertIncludes(apiSource, 'VITE_AUTH_COOKIE_FIRST !== "false"');
  assertIncludes(apiSource, "logout: () =>");
  assertIncludes(apiSource, 'request<void>("/auth/logout"');
  assertIncludes(authContextSource, "await api.logout()");
  assertIncludes(authContextSource, "sessionStorage.removeItem(SESSION_STORAGE_KEY)");
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}

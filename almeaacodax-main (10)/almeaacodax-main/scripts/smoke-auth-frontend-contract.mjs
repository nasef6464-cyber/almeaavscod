import { readFile } from "node:fs/promises";

const files = {
  app: await readFile(new URL("../App.tsx", import.meta.url), "utf8"),
  header: await readFile(new URL("../components/Header.tsx", import.meta.url), "utf8"),
  forgot: await readFile(new URL("../pages/ForgotPassword.tsx", import.meta.url), "utf8"),
  reset: await readFile(new URL("../pages/ResetPassword.tsx", import.meta.url), "utf8"),
  verify: await readFile(new URL("../pages/VerifyEmail.tsx", import.meta.url), "utf8"),
  api: await readFile(new URL("../services/api.ts", import.meta.url), "utf8"),
  readiness: await readFile(new URL("../PRODUCTION_READINESS_REPORT.md", import.meta.url), "utf8"),
};

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", message: error.message });
  }
}

function assertIncludes(source, fragment) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing fragment: ${fragment}`);
  }
}

check("auth recovery routes are registered", () => {
  assertIncludes(files.app, "ForgotPassword");
  assertIncludes(files.app, 'path="/forgot-password"');
  assertIncludes(files.app, 'path="/reset-password"');
  assertIncludes(files.app, 'path="/verify-email"');
});

check("login modal links to password recovery", () => {
  assertIncludes(files.header, "forgotPassword");
  assertIncludes(files.header, 'to="/forgot-password"');
  assertIncludes(files.header, "setIsLoginModalOpen(false)");
});

check("forgot password page calls backend helper", () => {
  assertIncludes(files.forgot, "api.forgotPassword");
  assertIncludes(files.forgot, "type=\"email\"");
  assertIncludes(files.forgot, "استعادة كلمة المرور");
});

check("reset password page uses token and validates minimum password length", () => {
  assertIncludes(files.reset, "api.resetPassword");
  assertIncludes(files.reset, "searchParams.get('token')");
  assertIncludes(files.reset, "password.length < 8");
});

check("verify email page supports token verification and resend", () => {
  assertIncludes(files.verify, "api.verifyEmail");
  assertIncludes(files.verify, "api.resendEmailVerification");
  assertIncludes(files.verify, "searchParams.get('token')");
});

check("frontend API helpers and readiness docs are aligned", () => {
  assertIncludes(files.api, "forgotPassword:");
  assertIncludes(files.api, "resetPassword:");
  assertIncludes(files.api, "verifyEmail:");
  assertIncludes(files.readiness, "Auth Frontend Recovery Sprint - 2026-05-12");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Auth frontend contract passed (${checks.length} checks).`);

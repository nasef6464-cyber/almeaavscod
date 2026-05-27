import { readFile } from "node:fs/promises";

const files = {
  auth: await readFile(new URL("../server/src/routes/auth.routes.ts", import.meta.url), "utf8"),
  user: await readFile(new URL("../server/src/models/User.ts", import.meta.url), "utf8"),
  api: await readFile(new URL("../services/api.ts", import.meta.url), "utf8"),
  guide: await readFile(new URL("../AUTH_ACCOUNT_SECURITY.md", import.meta.url), "utf8"),
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

function assertNotIncludes(source, fragment) {
  if (source.includes(fragment)) {
    throw new Error(`Unexpected fragment: ${fragment}`);
  }
}

check("user model stores only hashed account recovery tokens", () => {
  assertIncludes(files.user, "emailVerificationTokenHash");
  assertIncludes(files.user, "passwordResetTokenHash");
  assertIncludes(files.user, "delete safeRet.emailVerificationTokenHash");
  assertIncludes(files.user, "delete safeRet.passwordResetTokenHash");
});

check("auth routes implement verification and password reset", () => {
  assertIncludes(files.auth, '"/forgot-password"');
  assertIncludes(files.auth, '"/reset-password"');
  assertIncludes(files.auth, '"/email/verify"');
  assertIncludes(files.auth, '"/email/resend-verification"');
  assertIncludes(files.auth, "createHash(\"sha256\")");
});

check("forgot password is generic and queued through notifications", () => {
  assertIncludes(files.auth, "If this email exists, password reset instructions will be sent.");
  assertIncludes(files.auth, "createNotificationDeliveries");
  assertIncludes(files.auth, "passwordResetTokenHash = hashToken(token)");
  assertNotIncludes(files.auth, "return res.json({ token");
});

check("frontend API exposes auth recovery helpers", () => {
  assertIncludes(files.api, "forgotPassword:");
  assertIncludes(files.api, "resetPassword:");
  assertIncludes(files.api, "verifyEmail:");
  assertIncludes(files.api, "resendEmailVerification:");
});

check("auth guide and readiness report document the sprint", () => {
  assertIncludes(files.guide, "tokens are stored as SHA-256 hashes");
  assertIncludes(files.guide, "EMAIL_PROVIDER=console");
  assertIncludes(files.readiness, "Auth Recovery Sprint - 2026-05-12");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Auth account contract passed (${checks.length} checks).`);

import { readFile } from "node:fs/promises";

const files = {
  api: await readFile(new URL("../services/api.ts", import.meta.url), "utf8"),
  adapter: await readFile(new URL("../services/adapter.ts", import.meta.url), "utf8"),
  authContext: await readFile(new URL("../contexts/AuthContext.tsx", import.meta.url), "utf8"),
  phase5Report: await readFile(new URL("../05_FRONTEND_IMPLEMENTATION_REPORT.md", import.meta.url), "utf8").catch(() => ""),
};

const checks = [];

function check(name, fn) {
  checks.push([name, fn]);
}

function assertIncludes(source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`Expected to find: ${expected}`);
  }
}

check("api client keeps paginated backend responses compatible with existing pages", () => {
  assertIncludes(files.api, "extractList");
  assertIncludes(files.api, "withQuery");
  assertIncludes(files.api, "interface PaginationOptions");
  assertIncludes(files.api, 'withQuery("/auth/admin/users"');
  assertIncludes(files.api, 'withQuery("/payments/requests"');
  assertIncludes(files.api, 'withQuery("/courses"');
  assertIncludes(files.api, 'withQuery("/quizzes"');
  assertIncludes(files.api, 'withQuery("/quizzes/results"');
});

check("adapter still normalizes course and quiz arrays after API compatibility layer", () => {
  assertIncludes(files.adapter, "normalizeCourse");
  assertIncludes(files.adapter, "normalizeQuiz");
  assertIncludes(files.adapter, "const data = await api.getCourses()");
  assertIncludes(files.adapter, "const data = await api.getQuizzes()");
});

check("auth bootstrap keeps heavy quiz data non-critical", () => {
  assertIncludes(files.authContext, "hydrateNonCriticalSessionData");
  assertIncludes(files.authContext, "requestIdleCallback");
  assertIncludes(files.authContext, "api.getCurrentUser()");
});

check("phase five report documents no visual UI changes", () => {
  assertIncludes(files.phase5Report, "No visual UI/UX changes were made");
  assertIncludes(files.phase5Report, "services/api.ts");
  assertIncludes(files.phase5Report, "STOP");
});

for (const [name, fn] of checks) {
  try {
    fn();
  } catch (error) {
    console.error(`Frontend phase 5 contract failed: ${name}`);
    console.error(error);
    process.exit(1);
  }
}

console.log(`Frontend phase 5 contract passed (${checks.length} checks).`);

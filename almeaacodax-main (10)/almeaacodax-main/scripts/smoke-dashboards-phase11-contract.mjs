import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const files = {
  quizRoutes: await read("server/src/routes/quiz.routes.ts"),
  api: await read("services/api.ts"),
  dashboard: await read("pages/Dashboard.tsx"),
  reports: await read("pages/Reports.tsx"),
};

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

function assertNotIncludes(source, fragment, message) {
  if (source.includes(fragment)) {
    throw new Error(message || `Unexpected fragment: ${fragment}`);
  }
}

function assertAnyIncludes(source, fragments, message) {
  if (!fragments.some((fragment) => source.includes(fragment))) {
    throw new Error(message || `Missing all expected fragments: ${fragments.join(", ")}`);
  }
}

const analyticsStart = files.quizRoutes.indexOf('"/analytics/overview"');
const analyticsEnd = files.quizRoutes.indexOf('"/results"', analyticsStart);
const analyticsRoute = files.quizRoutes.slice(analyticsStart, analyticsEnd);

const scopedStudentsStart = files.quizRoutes.indexOf("const resolveScopedStudents");
const scopedStudentsEnd = files.quizRoutes.indexOf("const filterResultsByManagedScope", scopedStudentsStart);
const scopedStudentsHelper = files.quizRoutes.slice(scopedStudentsStart, scopedStudentsEnd);

check("dashboard scoped students are queried by role instead of loading every student", () => {
  assertIncludes(files.quizRoutes, "buildScopedStudentFilter");
  assertIncludes(files.quizRoutes, "STUDENT_DASHBOARD_SELECT");
  assertIncludes(scopedStudentsHelper, "UserModel.find(filter)");
  assertIncludes(scopedStudentsHelper, "countDocuments(filter)");
  assertIncludes(scopedStudentsHelper, ".limit(limit)");
  assertNotIncludes(scopedStudentsHelper, 'UserModel.find({ role: "student" })');
});

check("analytics overview has bounded work for high-scale dashboards", () => {
  assertIncludes(files.quizRoutes, "dashboardAnalyticsQuerySchema");
  assertIncludes(analyticsRoute, "studentLimit");
  assertIncludes(analyticsRoute, "resultLimit");
  assertIncludes(analyticsRoute, "attemptLimit");
  assertIncludes(analyticsRoute, ".limit(query.resultLimit).lean()");
  assertIncludes(analyticsRoute, ".limit(query.attemptLimit).lean()");
  assertIncludes(analyticsRoute, "sampledStudentCount");
  assertIncludes(analyticsRoute, "isTruncated");
});

check("scoped quiz results remain paginated and role-scoped", () => {
  assertIncludes(files.quizRoutes, '"/results/scoped"');
  assertIncludes(files.quizRoutes, "resolvePagination(req.query");
  assertIncludes(files.quizRoutes, "filterResultsByManagedScope");
  assertIncludes(files.quizRoutes, "sampledStudentCount");
});

check("frontend API requests dashboard data with safe limits without visual rewrites", () => {
  assertIncludes(files.api, "getQuizAnalyticsOverview: (pagination: PaginationOptions = {})");
  assertIncludes(files.api, "studentLimit: 500");
  assertIncludes(files.api, "resultLimit: 2000");
  assertAnyIncludes(files.api, [
    "getScopedQuizResults: (pagination: PaginationOptions = {})",
    "getScopedQuizResults: (pagination: QuizResultsPaginationOptions = {})",
  ]);
  assertIncludes(files.dashboard, "api.getScopedQuizResults()");
  assertIncludes(files.reports, "api.getQuizAnalyticsOverview()");
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}

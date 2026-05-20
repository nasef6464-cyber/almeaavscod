import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const dashboard = await read("dashboards/admin/AdminDashboard.tsx");

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

check("supervisor overview has a compact command center", () => {
  assertIncludes(dashboard, "lg:col-span-2 bg-white p-6 rounded-2xl");
  assertIncludes(dashboard, "متوسط الأداء");
  assertIncludes(dashboard, "متابعة الطلاب");
  assertIncludes(dashboard, "أضعف المهارات");
  assertIncludes(dashboard, "المجموعات");
});

check("supervisor command center has quick workflow actions", () => {
  assertIncludes(dashboard, 'href="#/reports"');
  assertIncludes(dashboard, "setActiveTab('school-portal')");
  assertIncludes(dashboard, "setActiveTab('quizzes')");
});

check("supervisor analytics are scoped and derived from owned groups/students", () => {
  assertIncludes(dashboard, "scopedStudentIds");
  assertIncludes(dashboard, "scopedResults");
  assertIncludes(dashboard, "studentsNeedingFollowUp");
  assertIncludes(dashboard, "weakestSkills");
  assertIncludes(dashboard, "groupSnapshots");
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}

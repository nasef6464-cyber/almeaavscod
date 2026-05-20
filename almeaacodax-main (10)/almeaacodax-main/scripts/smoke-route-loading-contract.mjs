import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [appSource, headerSource, genericPathSource] = await Promise.all([
  read("App.tsx"),
  read("components/Header.tsx"),
  read("pages/GenericPathPage.tsx"),
]);

const checks = [];

function check(name, assertion) {
  checks.push({ name, assertion });
}

function assertIncludes(source, fragment, message = fragment) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing expected fragment: ${message}`);
  }
}

check("route loading fallback is a full branded shell, not a blank spinner", () => {
  assertIncludes(appSource, "const LoadingFallback = () => {");
  assertIncludes(appSource, "isDashboardRoute");
  assertIncludes(appSource, "text-blue-900");
  assertIncludes(appSource, "text-amber-500");
  assertIncludes(appSource, "loading-side");
  assertIncludes(appSource, "loading-card");
});

check("common student and public route chunks are prefetched for all users", () => {
  assertIncludes(appSource, "const prefetchCommonRouteModules = (role?: string | null) =>");
  assertIncludes(appSource, "void import('./pages/Dashboard')");
  assertIncludes(appSource, "void import('./pages/GenericPathPage')");
  assertIncludes(appSource, "void import('./pages/Quizzes')");
  assertIncludes(appSource, "void import('./pages/MockExams')");
  assertIncludes(appSource, "void import('./pages/Courses')");
  assertIncludes(appSource, "prefetchCommonRouteModules()");
});

check("admin dashboard chunk is reusable and prefetched only as an extra for privileged users", () => {
  assertIncludes(appSource, "const loadAdminDashboardModule = () => import('./dashboards/admin/AdminDashboard')");
  assertIncludes(appSource, "void loadAdminDashboardModule()");
  assertIncludes(appSource, "role === 'admin'");
  assertIncludes(appSource, "role === 'teacher'");
  assertIncludes(appSource, "role === 'supervisor'");
  assertIncludes(appSource, "prefetchCommonRouteModules(user.role)");
});

check("public routes load navigation bootstrap early", () => {
  assertIncludes(appSource, "const loadPublicNavigationBootstrap = async () =>");
  assertIncludes(appSource, "adapter.getTaxonomyBootstrap()");
  assertIncludes(appSource, "hydrateTaxonomy({");
  assertIncludes(appSource, "void loadPublicNavigationBootstrap()");
});

check("header avoids showing incomplete navigation as final UI", () => {
  assertIncludes(headerSource, "showNavigationLoading");
  assertIncludes(headerSource, "navigationLoadingExpired");
  assertIncludes(headerSource, "setNavigationLoadingExpired(true)");
  assertIncludes(headerSource, "1800");
  assertIncludes(headerSource, "paths.length === 0");
  assertIncludes(headerSource, "navigationMenu.length <= 2");
  assertIncludes(headerSource, "nav-loading");
});

check("subject query is not removed before lazy taxonomy arrives", () => {
  assertIncludes(genericPathSource, "const pathSubjectsLoaded = pathSubjects.length > 0");
  assertIncludes(genericPathSource, "if (selectedSubjectId && !pathSubjectsLoaded)");
  assertIncludes(genericPathSource, "return;");
  assertIncludes(genericPathSource, "pathSubjects.length");
});

let failures = 0;
for (const item of checks) {
  try {
    item.assertion();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log("Route loading contract is intact.");
}

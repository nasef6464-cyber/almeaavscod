import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const adminDashboardPath = path.join(root, "dashboards", "admin", "AdminDashboard.tsx");
const usersManagerPath = path.join(root, "dashboards", "admin", "UsersManager.tsx");

const adminDashboard = fs.readFileSync(adminDashboardPath, "utf8");
const usersManager = fs.readFileSync(usersManagerPath, "utf8");

const checks = [
  {
    name: "admin school command center exists",
    ok: adminDashboard.includes("مركز التقارير والإشراف المدرسي") && adminDashboard.includes("schoolCommandCenter"),
  },
  {
    name: "school readiness signals are computed",
    ok:
      adminDashboard.includes("studentsWithoutClass") &&
      adminDashboard.includes("studentsWithoutParent") &&
      adminDashboard.includes("activeSchoolPackages") &&
      adminDashboard.includes("performanceWatch"),
  },
  {
    name: "school command center links to operational actions",
    ok:
      adminDashboard.includes("setActiveTab('groups')") &&
      adminDashboard.includes("setActiveTab('quizzes')") &&
      adminDashboard.includes("setActiveTab('announcement-ads')") &&
      adminDashboard.includes("#/reports"),
  },
  {
    name: "supervisor scope supports school and multiple groups",
    ok:
      adminDashboard.includes("scopedSchoolIds") &&
      adminDashboard.includes("directGroups") &&
      adminDashboard.includes("schoolCount: scopedSchoolIds.size"),
  },
  {
    name: "supervisor dashboard has action cards for school follow-up workflows",
    ok:
      adminDashboard.includes("supervisorActionCards") &&
      adminDashboard.includes("اختبار موجه للنطاق") &&
      adminDashboard.includes("رسالة متابعة جاهزة") &&
      adminDashboard.includes("بوابة المدرسة"),
  },
  {
    name: "user manager uses multi-select supervisor assignments",
    ok:
      usersManager.includes("handleSupervisorGroupsChange") &&
      usersManager.includes("MultiSelectField") &&
      usersManager.includes("اختر مدرسة أو فصلًا أو أكثر") &&
      !usersManager.includes("handleSupervisorGroupChange"),
  },
];

const failures = checks.filter((check) => !check.ok);

if (failures.length > 0) {
  console.error("Admin school command center smoke failed:");
  failures.forEach((failure) => console.error(`- ${failure.name}`));
  process.exit(1);
}

console.log(`Admin school command center contract passed (${checks.length} checks).`);

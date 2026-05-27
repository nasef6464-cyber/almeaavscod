import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const typeSource = fs.readFileSync(path.join(root, 'types.ts'), 'utf8');
const packageModelSource = fs.readFileSync(path.join(root, 'server/src/models/B2BPackage.ts'), 'utf8');
const contentRoutesSource = fs.readFileSync(path.join(root, 'server/src/routes/content.routes.ts'), 'utf8');
const schoolsManagerSource = fs.readFileSync(path.join(root, 'dashboards/admin/SchoolsManager.tsx'), 'utf8');
const financialManagerSource = fs.readFileSync(path.join(root, 'dashboards/admin/FinancialManager.tsx'), 'utf8');

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const assertIncludes = (source, snippet, message = snippet) => {
  if (!source.includes(snippet)) {
    throw new Error(`Missing: ${message}`);
  }
};

check('B2B package contract stores teacher and revenue share metadata', () => {
  assertIncludes(typeSource, 'assignedTeacherId?: string;');
  assertIncludes(typeSource, 'revenueSharePercentage?: number;');
  assertIncludes(packageModelSource, 'assignedTeacherId: { type: String');
  assertIncludes(packageModelSource, 'revenueSharePercentage: { type: Number');
  assertIncludes(contentRoutesSource, 'assignedTeacherId: z.string().optional()');
  assertIncludes(contentRoutesSource, 'revenueSharePercentage: z.number().nullable().optional()');
});

check('school package manager lets admin assign trainer and share percentage', () => {
  assertIncludes(schoolsManagerSource, 'المعلم/المدرب المرتبط');
  assertIncludes(schoolsManagerSource, 'نسبة المعلم من دخل الباقة');
  assertIncludes(schoolsManagerSource, 'updateB2BPackage(pkg.id, { revenueSharePercentage: value })');
  assertIncludes(schoolsManagerSource, 'assignedTeacherId: event.target.value');
});

check('school package exports include trainer revenue fields', () => {
  assertIncludes(schoolsManagerSource, 'المعلم/المدرب');
  assertIncludes(schoolsManagerSource, 'نسبة المعلم');
  assertIncludes(schoolsManagerSource, "packageTeacher?.name || 'غير محدد'");
});

check('financial dashboard summarizes teacher shares for school packages', () => {
  assertIncludes(financialManagerSource, 'teacherShare');
  assertIncludes(financialManagerSource, 'schoolPackagesSummary.teacherShares');
  assertIncludes(financialManagerSource, 'حصة المعلمين التقديرية');
  assertIncludes(financialManagerSource, 'assignedTeacherName');
});

let failed = 0;
for (const item of checks) {
  try {
    item.fn();
    console.log(`PASS ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${item.name}`);
    console.error(error.message);
  }
}

if (failed) {
  console.error(`\n${failed}/${checks.length} package revenue contract checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} package revenue contract smoke checks passed.`);

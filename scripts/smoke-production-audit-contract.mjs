import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const checks = [
  {
    name: "production env example disables local admin bypass",
    ok: () => /DEV_LOCAL_ADMIN_BYPASS=false/.test(read("server/.env.example")),
  },
  {
    name: "local admin bypass is disabled in production even if env is misconfigured",
    ok: () => /env\.DEV_LOCAL_ADMIN_BYPASS && env\.NODE_ENV !== "production" && isStrictLocalRequest\(req\)/.test(read("server/src/middleware/auth.ts")),
  },
  {
    name: "legacy Firebase sync is development-only",
    ok: () => /import\.meta\.env\.DEV && import\.meta\.env\.VITE_USE_REAL_API === 'false'/.test(read("App.tsx")),
  },
  {
    name: "admin audit model exists",
    ok: () => /AdminAuditLogModel/.test(read("server/src/models/AdminAuditLog.ts")),
  },
  {
    name: "blocked direct purchase is audited",
    ok: () => /auth\.direct_purchase\.blocked/.test(read("server/src/routes/auth.routes.ts")),
  },
  {
    name: "blocked direct quiz result creation is audited",
    ok: () => /quiz\.direct_result\.blocked/.test(read("server/src/routes/quiz.routes.ts")),
  },
  {
    name: "payment review is audited",
    ok: () => /payment\.request\.review/.test(read("server/src/routes/payment.routes.ts")),
  },
  {
    name: "admin audit logs are exposed to admins through operations",
    ok: () => /\/admin-audit-logs/.test(read("server/src/routes/operations.routes.ts")),
  },
  {
    name: "foundation paid/free access is controlled per topic",
    ok: () => {
      const source = read("components/LearningSection.tsx");
      return /topic\.isLocked === true/.test(source) && !/isLocked: isPremiumLocked\(settings\.lockSkillsForNonSubscribers/.test(source);
    },
  },
];

const failed = checks.filter((check) => !check.ok());

if (failed.length) {
  console.error("Production audit contract failed:");
  failed.forEach((check) => console.error(`- ${check.name}`));
  process.exit(1);
}

console.log(`Production audit contract passed (${checks.length} checks).`);

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const handoverPath = path.join(root, "docs", "project-handover", "16_CURRENT_WORKING_STATE_AR.md");
const indexPath = path.join(root, "docs", "project-handover", "README.md");

const handover = fs.readFileSync(handoverPath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");

const required = [
  ["latest commit", "338a96e"],
  ["frontend url", "https://almeaacodax.vercel.app/"],
  ["api url", "https://almeaacodax-k2ux.onrender.com/api"],
  ["github repo", "https://github.com/nasef6464/almeaacodax.git"],
  ["working branch", "complete-platform-production-v1"],
  ["zero ui destruction", "لا تغيّر شكل الموقع"],
  ["internal browser rule", "المتصفح الداخلي"],
  ["vercel env", "VITE_API_URL"],
  ["render env", "MONGODB_URI"],
  ["redis scale", "REDIS_URL"],
  ["school smoke", "smoke:school-portal-command"],
  ["frontend smoke", "smoke:frontend"],
  ["next backlog", "الأولوية التالية المقترحة"],
  ["current limitations", "ليس “جاهزًا نظريًا لـ 10,000 طالب”"],
];

const failures = required.filter(([, needle]) => !handover.includes(needle));
if (!index.includes("16_CURRENT_WORKING_STATE_AR.md")) {
  failures.push(["handover index", "16_CURRENT_WORKING_STATE_AR.md"]);
}

if (failures.length > 0) {
  console.error("Current handover contract failed:");
  failures.forEach(([name, needle]) => console.error(`- ${name}: missing ${needle}`));
  process.exit(1);
}

console.log(`Current handover contract passed (${required.length + 1} checks).`);

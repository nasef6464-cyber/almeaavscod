import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const apiBase = (process.env.LOAD_API_BASE || "https://almeaacodax-k2ux.onrender.com/api").replace(/\/$/, "");
const studentEmail = process.env.LOAD_STUDENT_EMAIL || "student.a@almeaa.local";
const studentPassword = process.env.LOAD_STUDENT_PASSWORD || "Student@123";
const levels = [20, 100, 500, 1000];
const durationSeconds = Number(process.env.LOAD_DURATION_SECONDS || 12);
const outDir = path.resolve("load-tests/results");

fs.mkdirSync(outDir, { recursive: true });

function run(cmd) {
  execSync(cmd, { stdio: "inherit", windowsHide: true });
}

async function loginToken() {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: studentEmail, password: studentPassword }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`login failed ${response.status}: ${raw.slice(0, 180)}`);
  }
  const json = JSON.parse(raw);
  if (!json?.token) throw new Error("login token missing");
  return json.token;
}

function readResult(filePath) {
  const raw = fs.readFileSync(filePath);
  let text = raw.toString("utf8");
  if (text.includes("\u0000")) text = raw.toString("utf16le");
  text = text.replace(/\u0000/g, "").trim();
  const line = text
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith("{"));
  if (!line) return null;
  return JSON.parse(line);
}

function summarize(records) {
  return records.map((item) => ({
    file: path.basename(item.file),
    endpoint: item.endpoint,
    concurrency: item.result.connections,
    requestsPerSec: Number(item.result.requests?.average || 0),
    p95: Number(item.result.latency?.p95 || item.result.latency?.p97_5 || 0),
    p99: Number(item.result.latency?.p99 || 0),
    avg: Number(item.result.latency?.average || 0),
    errors: Number(item.result.errors || 0),
    timeouts: Number(item.result.timeouts || 0),
    non2xx: Number(item.result.non2xx || 0),
    statusCodeStats: item.result.statusCodeStats || {},
  }));
}

const commandsForLevel = (c, token) => [
  {
    endpoint: "/health",
    file: path.join(outDir, `prod_health_c${c}.jsonl`),
    cmd: `npx autocannon "${apiBase}/health" -c ${c} -d ${durationSeconds} --json > "${path.join(outDir, `prod_health_c${c}.jsonl`)}"`,
  },
  {
    endpoint: "/content/bootstrap",
    file: path.join(outDir, `prod_content_bootstrap_c${c}.jsonl`),
    cmd: `npx autocannon "${apiBase}/content/bootstrap" -c ${c} -d ${durationSeconds} --json > "${path.join(outDir, `prod_content_bootstrap_c${c}.jsonl`)}"`,
  },
  {
    endpoint: "/auth/login",
    file: path.join(outDir, `prod_auth_login_c${c}.jsonl`),
    cmd: `npx autocannon "${apiBase}/auth/login" -c ${c} -d ${durationSeconds} -m POST -H "content-type=application/json" -b "{\\"email\\":\\"${studentEmail}\\",\\"password\\":\\"${studentPassword}\\"}" --json > "${path.join(outDir, `prod_auth_login_c${c}.jsonl`)}"`,
  },
  {
    endpoint: "/quizzes/results",
    file: path.join(outDir, `prod_quizzes_results_c${c}.jsonl`),
    cmd: `npx autocannon "${apiBase}/quizzes/results" -c ${c} -d ${durationSeconds} -H "authorization=Bearer ${token}" -H "content-type=application/json" --json > "${path.join(outDir, `prod_quizzes_results_c${c}.jsonl`)}"`,
  },
];

const token = await loginToken();
const generated = [];

for (const c of levels) {
  const runs = commandsForLevel(c, token);
  for (const item of runs) {
    run(item.cmd);
    const result = readResult(item.file);
    if (result) generated.push({ ...item, result });
  }
}

const summary = summarize(generated);
const summaryPath = path.join(outDir, "prod_load_summary.json");
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
console.log(`Load test summary saved: ${summaryPath}`);

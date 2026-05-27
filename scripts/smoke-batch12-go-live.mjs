import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FRONTEND_URL = process.env.GOLIVE_FRONTEND_URL || "https://almeaavscod.vercel.app";
const API_BASE = (process.env.GOLIVE_API_BASE || "https://almeaavscod.onrender.com/api").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.GOLIVE_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.GOLIVE_ADMIN_PASSWORD || "";

function runStep(name, command) {
  try {
    execSync(command, { stdio: "inherit", windowsHide: true });
    return { name, status: "pass", note: command };
  } catch (error) {
    return { name, status: "fail", note: `${command}\n${String(error?.message || error)}` };
  }
}

async function checkUrl(url) {
  const started = Date.now();
  try {
    const response = await fetch(url, { method: "GET" });
    const elapsedMs = Date.now() - started;
    return {
      url,
      ok: response.ok,
      status: response.status,
      elapsedMs,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      error: String(error?.message || error),
    };
  }
}

async function tryAdminReadiness() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return {
      status: "external_pending",
      note: "Missing GOLIVE_ADMIN_EMAIL / GOLIVE_ADMIN_PASSWORD; readiness endpoint auth check skipped.",
      readiness: null,
    };
  }

  try {
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!loginResponse.ok) {
      return {
        status: "fail",
        note: `Admin login failed with status ${loginResponse.status}.`,
        readiness: null,
      };
    }
    const loginJson = await loginResponse.json();
    const token = loginJson?.token;
    if (!token) {
      return { status: "fail", note: "Admin login token missing.", readiness: null };
    }

    const readinessResponse = await fetch(`${API_BASE}/operations/integrations-readiness`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    const readinessJson = await readinessResponse.json().catch(() => ({}));
    if (!readinessResponse.ok) {
      return {
        status: "fail",
        note: `Readiness endpoint failed (${readinessResponse.status}).`,
        readiness: readinessJson,
      };
    }

    return {
      status: "pass",
      note: "Admin integrations readiness endpoint checked successfully.",
      readiness: readinessJson,
    };
  } catch (error) {
    return {
      status: "fail",
      note: String(error?.message || error),
      readiness: null,
    };
  }
}

function sectionStatus(allPass, hasFail) {
  if (allPass) return "مقفول نهائيًا";
  if (hasFail) return "غير مكتمل";
  return "ينتظر تفعيل خارجي";
}

const localSteps = [
  runStep("Package/Course Split Contract", "npm run smoke:package-course-split"),
  runStep("Payment Package Contract", "npm run smoke:payment-package"),
  runStep("Payment Providers Contract", "npm run smoke:payment-providers"),
  runStep("API Phase 4 Contract", "npm run smoke:api-phase4"),
];

const frontendProbe = await checkUrl(FRONTEND_URL);
const healthProbe = await checkUrl(`${API_BASE}/health`);
const adminReadiness = await tryAdminReadiness();

const localAllPass = localSteps.every((s) => s.status === "pass");
const localHasFail = localSteps.some((s) => s.status === "fail");
const runtimeAllPass = frontendProbe.ok && healthProbe.ok && adminReadiness.status === "pass";
const runtimeHasFail = !frontendProbe.ok || !healthProbe.ok || adminReadiness.status === "fail";

const localStatus = sectionStatus(localAllPass, localHasFail);
const runtimeStatus = sectionStatus(runtimeAllPass, runtimeHasFail);

const finalStatus =
  localStatus === "مقفول نهائيًا" && runtimeStatus === "مقفول نهائيًا"
    ? "مقفول نهائيًا"
    : localStatus === "غير مكتمل" || runtimeStatus === "غير مكتمل"
      ? "غير مكتمل"
      : "ينتظر تفعيل خارجي";

const nowIso = new Date().toISOString();
const reportPath = path.resolve("docs/BATCH_1_2_FINAL_GO_LIVE_2026-05-14_AR.md");

const lines = [
  "# تقرير الإغلاق النهائي - دفعة 1 + 2",
  "",
  `- التاريخ: ${nowIso}`,
  `- Frontend: \`${FRONTEND_URL}\``,
  `- API: \`${API_BASE}\``,
  "",
  "## نتيجة الدفعة",
  `- الحالة النهائية: **${finalStatus}**`,
  `- حالة الاختبارات المحلية: **${localStatus}**`,
  `- حالة الفحص التشغيلي على الإنتاج: **${runtimeStatus}**`,
  "",
  "## 1) فصل الباقات/الدورات + الدفع (الاختبارات المحلية)",
  "",
  ...localSteps.map((step) => `- ${step.status === "pass" ? "✅" : "❌"} ${step.name}`),
  "",
  "## 2) التشغيل الإنتاجي النهائي",
  "",
  `- ${frontendProbe.ok ? "✅" : "❌"} فتح الواجهة: status=${frontendProbe.status} time=${frontendProbe.elapsedMs}ms`,
  `- ${healthProbe.ok ? "✅" : "❌"} صحة الـ API: status=${healthProbe.status} time=${healthProbe.elapsedMs}ms`,
  `- ${adminReadiness.status === "pass" ? "✅" : adminReadiness.status === "external_pending" ? "⏳" : "❌"} جاهزية التكاملات (Admin): ${adminReadiness.note}`,
  "",
  "## تصنيف واضح حسب القاعدة الجديدة",
  "",
  "- **مقفول نهائيًا**: كل اختبارات الدفعة نجحت + فحص التشغيل الإنتاجي مكتمل.",
  "- **ينتظر تفعيل خارجي**: الكود والاختبارات ناجحة لكن ينقص Credentials/تهيئة خارجية.",
  "- **غير مكتمل**: يوجد فشل فعلي في اختبار أو مسار تشغيلي.",
  "",
  "## ملاحظات",
  "",
  "- إذا ظهر `ينتظر تفعيل خارجي` فهذا يعني أن الإغلاق البرمجي مكتمل، والمتبقي إدخال مفاتيح الإنتاج وربط المزودات من المالك.",
  "",
  "## مرفقات",
  "",
  "- `docs/BATCH_INTEGRATIONS_REGISTRATION_2026-05-14.md`",
  "- `LOAD_TEST_REPORT.md`",
  "- `docs/PHASE_3_4_CLOSURE_2026-05-14.md`",
];

if (adminReadiness.readiness) {
  lines.push("", "## بيانات readiness (raw)", "", "```json", JSON.stringify(adminReadiness.readiness, null, 2), "```");
}

fs.writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Batch 1+2 final go-live report generated: ${reportPath}`);

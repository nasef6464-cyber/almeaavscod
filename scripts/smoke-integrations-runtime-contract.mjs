import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const contentRoutes = read("server/src/routes/content.routes.ts");
const notificationRoutes = read("server/src/routes/notification.routes.ts");
const notificationService = read("server/src/services/notificationService.ts");
const api = read("services/api.ts");
const manager = read("dashboards/admin/PlatformIntegrationsManager.tsx");

const checks = [];
const check = (name, fn) => checks.push({ name, fn });
const includes = (source, snippet) => {
  if (!source.includes(snippet)) {
    throw new Error(`Missing: ${snippet}`);
  }
};

check("platform integrations response masks secrets and preserves old values on partial save", () => {
  includes(contentRoutes, "maskSensitiveProviderValues");
  includes(contentRoutes, "mergeSensitiveProviderValues");
  includes(contentRoutes, "decryptIntegrationSecretsForRuntime");
  includes(contentRoutes, "encryptIntegrationSecretsAtRest");
  includes(contentRoutes, "providerSecretState");
  includes(contentRoutes, '"/platform-integrations"');
});

check("platform integrations route uses encryption helper import", () => {
  includes(contentRoutes, 'from "../utils/integrationSecretsCrypto.js"');
});

check("integration history list returns masked secret state only", () => {
  includes(contentRoutes, "/platform-integrations/history");
  includes(contentRoutes, "safeHistory");
  includes(contentRoutes, "providerSecretState");
  includes(contentRoutes, "snapshot");
  includes(contentRoutes, "maskIntegrationSnapshot");
});

check("integration restore endpoint returns masked settings", () => {
  includes(contentRoutes, "/platform-integrations/history/:id/restore");
  includes(contentRoutes, "runtimeSnapshot");
  includes(contentRoutes, "encryptedPayload");
  includes(contentRoutes, "safeSettings");
  includes(contentRoutes, "return res.json({ settings: safeSettings, restoredFrom");
});

check("runtime audit endpoint exists and includes env/runtime readiness checks", () => {
  includes(contentRoutes, '"/platform-integrations/runtime-audit"');
  includes(contentRoutes, "runtimeReady");
  includes(contentRoutes, "getRedisHealth(\"queue\"");
  includes(contentRoutes, "WHATSAPP_PROVIDER");
  includes(contentRoutes, "EMAIL_PROVIDER");
  includes(contentRoutes, "SENTRY_DSN");
});

check("setup checklist endpoint still exists with callback/webhook guidance", () => {
  includes(contentRoutes, '"/platform-integrations/setup-checklist"');
  includes(contentRoutes, "callbackUrl");
  includes(contentRoutes, "webhookUrl");
  includes(contentRoutes, "GOOGLE_CLIENT_ID");
  includes(contentRoutes, "WHATSAPP_ACCESS_TOKEN");
});

check("admin test-delivery endpoint exists for email and whatsapp", () => {
  includes(notificationRoutes, '"/admin/test-delivery"');
  includes(notificationRoutes, "integrationTestSchema");
  includes(notificationRoutes, "recipientEmail is required for email test.");
  includes(notificationRoutes, "recipientPhone is required for whatsapp test.");
  includes(notificationRoutes, "sendExternalNotification");
});

check("notification service forwards recipient phone for whatsapp deliveries", () => {
  includes(notificationService, "phone?: string;");
  includes(notificationService, '.select("_id id name email role phone")');
  includes(notificationService, "recipientPhone: recipient.phone || \"\",");
});

check("frontend API exposes runtime audit and test delivery actions", () => {
  includes(api, "getPlatformIntegrationsRuntimeAudit");
  includes(api, "testIntegrationDelivery");
  includes(api, '"/notifications/admin/test-delivery"');
});

check("integrations manager renders runtime audit and send test controls", () => {
  includes(manager, "فحص التشغيل الفعلي (Runtime)");
  includes(manager, "اختبار إرسال التكاملات");
  includes(manager, "sendIntegrationTest");
  includes(manager, "testChannel");
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
  console.error(`\n${failed}/${checks.length} integrations runtime checks failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} integrations runtime checks passed.`);

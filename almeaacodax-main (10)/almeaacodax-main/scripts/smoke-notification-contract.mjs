import { readFile } from "node:fs/promises";

const files = {
  template: await readFile(new URL("../server/src/models/NotificationTemplate.ts", import.meta.url), "utf8"),
  delivery: await readFile(new URL("../server/src/models/NotificationDelivery.ts", import.meta.url), "utf8"),
  service: await readFile(new URL("../server/src/services/notificationService.ts", import.meta.url), "utf8"),
  providers: await readFile(new URL("../server/src/services/notificationProviders.ts", import.meta.url), "utf8"),
  route: await readFile(new URL("../server/src/routes/notification.routes.ts", import.meta.url), "utf8"),
  index: await readFile(new URL("../server/src/routes/index.ts", import.meta.url), "utf8"),
  env: await readFile(new URL("../server/.env.example", import.meta.url), "utf8"),
  guide: await readFile(new URL("../NOTIFICATION_SYSTEM_GUIDE.md", import.meta.url), "utf8"),
  whatsapp: await readFile(new URL("../WHATSAPP_INTEGRATION_GUIDE.md", import.meta.url), "utf8"),
  readiness: await readFile(new URL("../PRODUCTION_READINESS_REPORT.md", import.meta.url), "utf8"),
};

const checks = [];

function check(name, assertion) {
  try {
    assertion();
    checks.push({ name, status: "PASS" });
  } catch (error) {
    checks.push({ name, status: "FAIL", message: error.message });
  }
}

function assertIncludes(source, fragment) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing fragment: ${fragment}`);
  }
}

function assertNotIncludes(source, fragment) {
  if (source.includes(fragment)) {
    throw new Error(`Unexpected fragment: ${fragment}`);
  }
}

check("notification models include templates and delivery states", () => {
  assertIncludes(files.template, "NotificationTemplateModel");
  assertIncludes(files.delivery, 'enum: ["pending", "sent", "failed", "retrying"]');
  assertIncludes(files.delivery, "notificationDeliverySchema.index({ recipientUserId: 1, channel: 1, createdAt: -1 })");
});

check("notification service creates delivery records without bulk provider calls", () => {
  assertIncludes(files.service, "MAX_RECIPIENTS_PER_REQUEST = 500");
  assertIncludes(files.service, 'status: channel === "in_app" ? "sent" : "pending"');
  assertIncludes(files.service, "processPendingNotifications");
  assertNotIncludes(files.service, "fetch(");
});

check("external provider adapter supports production delivery modes", () => {
  assertIncludes(files.providers, "sendExternalNotification");
  assertIncludes(files.providers, "sendResendEmail");
  assertIncludes(files.providers, "sendHttpEmail");
  assertIncludes(files.providers, "sendWhatsAppCloud");
  assertIncludes(files.providers, "provider_http_");
});

check("notification routes protect admin actions", () => {
  assertIncludes(files.route, 'requireRole(["admin"])');
  assertIncludes(files.route, '"/admin/send"');
  assertIncludes(files.route, '"/admin/process-pending"');
  assertIncludes(files.index, 'apiRouter.use("/notifications", notificationRouter)');
});

check("notification env and docs exist", () => {
  assertIncludes(files.env, "EMAIL_PROVIDER=");
  assertIncludes(files.env, "RESEND_API_KEY=");
  assertIncludes(files.env, "EMAIL_WEBHOOK_URL=");
  assertIncludes(files.env, "WHATSAPP_PROVIDER=");
  assertIncludes(files.env, "WHATSAPP_PHONE_NUMBER_ID=");
  assertIncludes(files.guide, "EMAIL_PROVIDER=resend");
  assertIncludes(files.guide, "EMAIL_PROVIDER=http");
  assertIncludes(files.whatsapp, "WHATSAPP_PROVIDER=whatsapp_cloud");
});

check("readiness report records notification sprint", () => {
  assertIncludes(files.readiness, "Notification Foundation Sprint - 2026-05-12");
});

const failed = checks.filter((item) => item.status === "FAIL");
if (failed.length > 0) {
  console.error(JSON.stringify({ total: checks.length, failed }, null, 2));
  process.exit(1);
}

console.log(`Notification contract passed (${checks.length} checks).`);

import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const files = {
  packageJson: await read("server/package.json"),
  env: await read("server/src/config/env.ts"),
  example: await read("server/.env.example"),
  queue: await read("server/src/queues/notificationQueue.ts"),
  service: await read("server/src/services/notificationService.ts"),
  route: await read("server/src/routes/notification.routes.ts"),
  server: await read("server/src/server.ts"),
  guide: await read("NOTIFICATION_SYSTEM_GUIDE.md"),
  whatsapp: await read("WHATSAPP_INTEGRATION_GUIDE.md"),
};

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

function assertNotIncludes(source, fragment, message) {
  if (source.includes(fragment)) {
    throw new Error(message || `Unexpected fragment: ${fragment}`);
  }
}

check("backend includes BullMQ dependency and queue env controls", () => {
  assertIncludes(files.packageJson, '"bullmq"');
  assertIncludes(files.env, "NOTIFICATION_QUEUE_ENABLED");
  assertIncludes(files.env, "NOTIFICATION_QUEUE_CONCURRENCY");
  assertIncludes(files.example, "NOTIFICATION_QUEUE_ENABLED=true");
});

check("notification queue uses Redis, BullMQ, idempotent job ids, and retry policy", () => {
  assertIncludes(files.queue, 'Queue(NOTIFICATION_QUEUE_NAME');
  assertIncludes(files.queue, 'Worker(');
  assertIncludes(files.queue, 'jobId: `delivery:${deliveryId}`');
  assertIncludes(files.queue, "attempts: 4");
  assertIncludes(files.queue, 'backoff: { type: "exponential"');
});

check("workers are optional and started by server bootstrap", () => {
  assertIncludes(files.queue, "isNotificationQueueEnabled");
  assertIncludes(files.queue, "set REDIS_URL and NOTIFICATION_QUEUE_ENABLED=true");
  assertIncludes(files.server, "startNotificationWorkers()");
});

check("admin send route queues external deliveries and keeps inline fallback", () => {
  assertIncludes(files.route, "enqueueNotificationDeliveries");
  assertIncludes(files.route, "enqueuePendingNotifications");
  assertIncludes(files.route, 'mode: "inline-fallback"');
  assertIncludes(files.route, 'mode: "queued"');
});

check("notification service processes one delivery at a time without bulk provider calls in create path", () => {
  assertIncludes(files.service, "processNotificationDeliveryById");
  assertIncludes(files.service, "MAX_RECIPIENTS_PER_REQUEST = 500");
  assertIncludes(files.service, 'status: channel === "in_app" ? "sent" : "pending"');
  const createSection = files.service.slice(files.service.indexOf("export async function createNotificationDeliveries"), files.service.indexOf("export async function processNotificationDeliveryById"));
  assertNotIncludes(createSection, "sendExternalNotification");
});

check("docs describe Redis/BullMQ production operation", () => {
  assertIncludes(files.guide, "BullMQ/Redis queue support");
  assertIncludes(files.guide, "Queue name: `notifications`");
  assertIncludes(files.guide, "NOTIFICATION_QUEUE_CONCURRENCY=5");
  assertIncludes(files.whatsapp, "NOTIFICATION_QUEUE_ENABLED=true");
});

const failed = checks.filter((item) => item.status === "FAIL");
console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));

if (failed.length > 0) {
  process.exit(1);
}

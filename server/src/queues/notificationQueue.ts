import { Queue, Worker, type JobsOptions } from "bullmq";
import { getRedisClient } from "../config/redis.js";
import { env } from "../config/env.js";
import { isRedisConfigured } from "../config/redis.js";
import { NotificationDeliveryModel } from "../models/NotificationDelivery.js";
import { processNotificationDeliveryById } from "../services/notificationService.js";

const NOTIFICATION_QUEUE_NAME = "notifications";
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 4,
  backoff: { type: "exponential", delay: 60_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
};

let queue: Queue | null = null;
let worker: Worker | null = null;

function isNotificationQueueEnabled() {
  return env.NOTIFICATION_QUEUE_ENABLED && isRedisConfigured();
}

function createQueueConnection() {
  const client = getRedisClient();
  if (!client) throw new Error("Redis client not available");
  return client;
}

export function getNotificationQueue() {
  if (!isNotificationQueueEnabled()) {
    return null;
  }

  if (!queue) {
    queue = new Queue(NOTIFICATION_QUEUE_NAME, {
      connection: createQueueConnection(),
      prefix: `${env.REDIS_KEY_PREFIX}:bullmq`,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return queue;
}

export async function enqueueNotificationDeliveries(deliveryIds: string[]) {
  const activeQueue = getNotificationQueue();
  const ids = Array.from(new Set(deliveryIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!activeQueue || !ids.length) {
    return { queued: false, count: 0 };
  }

  await activeQueue.addBulk(
    ids.map((deliveryId) => ({
      name: "deliver-notification",
      data: { deliveryId },
      opts: {
        ...DEFAULT_JOB_OPTIONS,
        jobId: `delivery:${deliveryId}`,
      },
    })),
  );

  return { queued: true, count: ids.length };
}

export async function enqueuePendingNotifications(limit = 100) {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const pending = await NotificationDeliveryModel.find({
    status: { $in: ["pending", "retrying"] },
    channel: { $in: ["email", "whatsapp"] },
    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: Date.now() } }],
  })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .select("id")
    .lean();

  return enqueueNotificationDeliveries(pending.map((item) => String(item.id)));
}

export function startNotificationWorker() {
  if (!isNotificationQueueEnabled()) {
    console.info("[notifications] BullMQ worker disabled; set REDIS_URL and NOTIFICATION_QUEUE_ENABLED=true to enable it.");
    return null;
  }

  if (worker) {
    return worker;
  }

  worker = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      const deliveryId = String(job.data?.deliveryId || "");
      if (!deliveryId) {
        throw new Error("missing_delivery_id");
      }

      const result = await processNotificationDeliveryById(deliveryId);
      if (result.status === "retrying") {
        throw new Error("notification_provider_retrying");
      }
      if (result.status === "failed") {
        throw new Error("notification_provider_failed");
      }
      return result;
    },
    {
      connection: createQueueConnection(),
      prefix: `${env.REDIS_KEY_PREFIX}:bullmq`,
      concurrency: env.NOTIFICATION_QUEUE_CONCURRENCY,
    },
  );

  worker.on("completed", (job) => {
    console.info(`[notifications] delivered job=${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.warn(`[notifications] failed job=${job?.id || "unknown"} reason=${error.message}`);
  });

  return worker;
}

export async function closeNotificationQueue() {
  const activeWorker = worker;
  const activeQueue = queue;
  worker = null;
  queue = null;

  await Promise.allSettled([
    activeWorker?.close(),
    activeQueue?.close(),
  ].filter(Boolean) as Array<Promise<unknown>>);
}

import { Queue, Worker, Job } from "bullmq";
import { getRedisClient } from "../config/redis.js";
import { env } from "../config/env.js";
import { processNotificationDeliveryById, processPendingNotifications } from "../services/notificationService.js";

let notificationQueue: Queue | null = null;
let notificationWorker: Worker | null = null;

export function getNotificationQueue(): Queue | null {
  if (!env.NOTIFICATION_QUEUE_ENABLED) return null;
  if (notificationQueue) return notificationQueue;

  const redisClient = getRedisClient();
  if (!redisClient) return null;

  notificationQueue = new Queue("notifications", {
    connection: redisClient,
  });

  return notificationQueue;
}

export async function enqueueNotificationDeliveries(deliveries: Array<Record<string, unknown>>): Promise<void> {
  const queue = getNotificationQueue();
  if (!queue) return;
  for (const delivery of deliveries) {
    await queue.add("send-notification", delivery);
  }
}

export async function enqueuePendingNotifications(): Promise<number> {
  const queue = getNotificationQueue();
  if (!queue) return 0;

  const { scanned } = await processPendingNotifications(50);
  return scanned;
}

export function startNotificationWorker(): void {
  if (!env.NOTIFICATION_QUEUE_ENABLED) return;
  const redisClient = getRedisClient();
  if (!redisClient) return;

  notificationWorker = new Worker(
    "notifications",
    async (job: Job) => {
      const deliveryId = job.data?.id || job.data?.deliveryId || job.data?._id;
      if (!deliveryId) {
        console.warn(`[notification-worker] Job ${job.id} has no delivery ID, skipping`);
        return { processed: false, reason: "missing_delivery_id" };
      }

      console.log(`[notification-worker] Processing delivery ${deliveryId} (job ${job.id})`);
      const result = await processNotificationDeliveryById(String(deliveryId));
      return result;
    },
    {
      connection: redisClient,
      concurrency: env.NOTIFICATION_QUEUE_CONCURRENCY,
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 86400 },
    },
  );

  notificationWorker.on("completed", (job: Job) => {
    console.log(`[notification-worker] Job ${job.id} completed: ${JSON.stringify(job.returnvalue)}`);
  });

  notificationWorker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`[notification-worker] Job ${job?.id} failed:`, err.message);
  });

  notificationWorker.on("error", (err: Error) => {
    console.error(`[notification-worker] Worker error:`, err.message);
  });
}

export function stopNotificationWorker(): void {
  if (notificationWorker) {
    notificationWorker.close();
    notificationWorker = null;
  }
}

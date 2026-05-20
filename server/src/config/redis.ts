import IORedis from "ioredis";
import type { Redis } from "ioredis";
import { env } from "./env.js";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  if (!env.REDIS_URL) return null;

  redisClient = new IORedis.default(env.REDIS_URL, {
    keyPrefix: env.REDIS_KEY_PREFIX,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  redisClient.on("error", (err: Error) => {
    console.error("Redis client error:", err.message);
  });

  return redisClient;
}

export function createRedisClient(_prefix?: string): Redis | null {
  return getRedisClient();
}

export function isRedisConfigured(): boolean {
  return !!env.REDIS_URL;
}

export async function getRedisHealth(): Promise<{ status: string; pingMs?: number }> {
  const client = getRedisClient();
  if (!client) return { status: "disconnected" };
  try {
    const start = Date.now();
    await client.ping();
    return { status: "connected", pingMs: Date.now() - start };
  } catch {
    return { status: "error" };
  }
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client) {
    await client.connect();
    console.log("Redis connected");
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.disconnect();
    redisClient = null;
  }
}

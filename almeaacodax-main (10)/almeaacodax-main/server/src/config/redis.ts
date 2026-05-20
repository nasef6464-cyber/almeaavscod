import { Redis, type Redis as RedisClient } from "ioredis";
import { env } from "./env.js";

type RedisPurpose = "rate-limit" | "socket-pub" | "socket-sub" | "queue";

const clients = new Map<string, RedisClient>();
const DEFAULT_REDIS_HEALTH_TIMEOUT_MS = 800;

const buildRedisKey = (purpose: RedisPurpose) => `${purpose}:${env.REDIS_URL || "memory"}`;

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL && env.REDIS_URL.trim().length > 0);
}

export function createRedisClient(purpose: RedisPurpose) {
  if (!isRedisConfigured()) {
    return null;
  }

  const key = buildRedisKey(purpose);
  const existing = clients.get(key);
  if (existing) {
    return existing;
  }

  const client = new Redis(env.REDIS_URL, {
    keyPrefix: `${env.REDIS_KEY_PREFIX}:${purpose}:`,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times: number) {
      return Math.min(times * 250, 5000);
    },
  });

  client.on("connect", () => {
    console.info(`[redis] ${purpose} connected`);
  });

  client.on("error", (error: unknown) => {
    console.error(`[redis] ${purpose} error`, error);
  });

  clients.set(key, client);
  return client;
}

export function createRedisDuplicate(purpose: RedisPurpose) {
  const client = createRedisClient(purpose);
  return client ? client.duplicate({ keyPrefix: `${env.REDIS_KEY_PREFIX}:${purpose}:` }) : null;
}

export async function closeRedisClients() {
  const activeClients = Array.from(clients.values());
  clients.clear();

  await Promise.allSettled(
    activeClients.map(async (client) => {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    }),
  );
}

export async function getRedisHealth(
  purpose: RedisPurpose,
  options: { required?: boolean; timeoutMs?: number } = {},
) {
  const required = options.required === true;
  const timeoutMs = options.timeoutMs || DEFAULT_REDIS_HEALTH_TIMEOUT_MS;

  if (!isRedisConfigured()) {
    return {
      ok: !required,
      configured: false,
      required,
      purpose,
      status: required ? "missing" : "not_configured",
      latencyMs: null,
    };
  }

  const client = createRedisClient(purpose);
  if (!client) {
    return {
      ok: !required,
      configured: false,
      required,
      purpose,
      status: required ? "missing" : "not_configured",
      latencyMs: null,
    };
  }

  const startedAt = Date.now();
  try {
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("redis_health_timeout")), timeoutMs);
      }),
    ]);

    return {
      ok: true,
      configured: true,
      required,
      purpose,
      status: client.status || "ready",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      required,
      purpose,
      status: "unhealthy",
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "redis_health_failed",
    };
  }
}

import type { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { createRedisClient, createRedisDuplicate, isRedisConfigured } from "../config/redis.js";

export function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });

  if (isRedisConfigured()) {
    const pubClient = createRedisClient("socket-pub");
    const subClient = createRedisDuplicate("socket-sub");
    if (pubClient && subClient) {
      io.adapter(createAdapter(pubClient, subClient));
      console.info("[socket] Redis adapter enabled");
    }
  } else if (env.NODE_ENV === "production") {
    console.warn("[socket] Redis adapter disabled because REDIS_URL is not configured");
  }

  io.on("connection", (socket) => {
    socket.on("workspace:join", (workspaceId: string) => {
      socket.join(workspaceId);
    });

    socket.on("disconnect", () => {
      // reserved for audit/events later
    });
  });

  return io;
}

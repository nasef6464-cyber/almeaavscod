import type { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { env } from "../config/env.js";

type UserSocketMap = Map<string, Set<string>>;

const connectedUsers: UserSocketMap = new Map();

function addConnectedUser(userId: string, socketId: string) {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId)!.add(socketId);
}

function removeConnectedUser(userId: string, socketId: string) {
  const sockets = connectedUsers.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      connectedUsers.delete(userId);
    }
  }
}

function getConnectedUserIds(): string[] {
  return Array.from(connectedUsers.keys());
}

export function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
      credentials: true,
    },
  });

  if (env.REDIS_URL) {
    (async () => {
      try {
        const { createClient } = await import("redis");
        const { createAdapter } = await import("@socket.io/redis-adapter");
        const pubClient = createClient({ url: env.REDIS_URL, prefix: `${env.REDIS_KEY_PREFIX}:socket:` });
        const subClient = pubClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        console.log("[socket] Redis adapter enabled");
      } catch (err) {
        console.warn("[socket] Redis adapter failed, using in-memory:", err instanceof Error ? err.message : err);
      }
    })();
  }

  io.on("connection", (socket: Socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    socket.on("auth", (userId: string) => {
      addConnectedUser(userId, socket.id);
      socket.data.userId = userId;
      console.log(`[socket] User ${userId} authenticated on socket ${socket.id}`);
      socket.emit("auth:success", { userId });
    });

    socket.on("workspace:join", (workspaceId: string) => {
      socket.join(workspaceId);
      console.log(`[socket] Socket ${socket.id} joined workspace ${workspaceId}`);
    });

    socket.on("notification:subscribe", (userId: string) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[socket] Socket ${socket.id} subscribed to notifications for user ${userId}`);
      }
    });

    socket.on("notification:mark-read", (data: { userId: string; notificationId: string }) => {
      socket.to(`user:${data.userId}`).emit("notification:read", { notificationId: data.notificationId });
    });

    socket.on("presence:status", (status: "online" | "away" | "busy") => {
      const userId = socket.data.userId;
      if (userId) {
        io.emit("presence:update", { userId, status });
      }
    });

    socket.on("typing", (data: { roomId: string; userId: string }) => {
      socket.to(data.roomId).emit("user:typing", { userId: data.userId, socketId: socket.id });
    });

    socket.on("stop:typing", (data: { roomId: string; userId: string }) => {
      socket.to(data.roomId).emit("user:stop:typing", { userId: data.userId, socketId: socket.id });
    });

    socket.on("disconnect", () => {
      const userId = socket.data.userId;
      if (userId) {
        removeConnectedUser(userId, socket.id);
        io.emit("presence:update", { userId, status: "offline" });
        console.log(`[socket] User ${userId} disconnected from socket ${socket.id}`);
      } else {
        console.log(`[socket] Client disconnected: ${socket.id}`);
      }
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, data: unknown) {
  const io = getIoInstance();
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToWorkspace(workspaceId: string, event: string, data: unknown) {
  const io = getIoInstance();
  if (io) {
    io.to(workspaceId).emit(event, data);
  }
}

export function broadcast(event: string, data: unknown) {
  const io = getIoInstance();
  if (io) {
    io.emit(event, data);
  }
}

export function getOnlineUsers(): string[] {
  return getConnectedUserIds();
}

let ioInstance: Server | null = null;

export function setIoInstance(io: Server) {
  ioInstance = io;
}

export function getIoInstance(): Server | null {
  return ioInstance;
}

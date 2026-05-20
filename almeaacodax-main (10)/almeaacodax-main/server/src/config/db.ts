import mongoose from "mongoose";
import { env } from "./env.js";

let listenersInstalled = false;

function installConnectionListeners() {
  if (listenersInstalled) {
    return;
  }

  listenersInstalled = true;

  mongoose.connection.on("connected", () => {
    console.info("[database] MongoDB connected");
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[database] MongoDB disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.info("[database] MongoDB reconnected");
  });

  mongoose.connection.on("error", (error) => {
    console.error("[database] MongoDB connection error", error);
  });
}

export async function connectToDatabase() {
  mongoose.set("strictQuery", true);
  installConnectionListeners();
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
    minPoolSize: env.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: env.MONGODB_SOCKET_TIMEOUT_MS,
    maxIdleTimeMS: env.MONGODB_MAX_IDLE_TIME_MS,
  });
}

import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { csrfGuard } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { rejectUnsafeMongoKeys } from "./middleware/mongoSanitize.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRateLimiter, globalRateLimiter, sensitiveActionRateLimiter } from "./middleware/rateLimiters.js";
import { initSentry } from "./observability/sentry.js";

function parseAllowedOrigins() {
  const configuredOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const productionOrigins = [env.CLIENT_URL, "https://almeaavscod.vercel.app", ...configuredOrigins];
  const developmentOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ];

  return new Set(env.NODE_ENV === "production" ? productionOrigins : [...productionOrigins, ...developmentOrigins]);
}

function createCorsError() {
  const error = new Error("Origin is not allowed by CORS") as Error & { statusCode?: number };
  error.statusCode = 403;
  return error;
}

export function createApp() {
  initSentry();
  const app = express();
  app.set("trust proxy", 1);
  const allowedOrigins = parseAllowedOrigins();

  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(createCorsError());
      },
      credentials: true,
    }),
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use(compression());
  app.use(requestLogger);
  app.use("/api/auth", express.json({ limit: "100kb" }));
  app.use(globalRateLimiter);
  app.use(
    ["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password"],
    authRateLimiter,
  );
  app.use(
    ["/api/quizzes/*/submit", "/api/ai/*", "/api/payments/*", "/api/auth/me/redeem-access-code"],
    sensitiveActionRateLimiter,
  );
  app.use(["/api/quizzes", "/api/payments", "/api/ai"], express.json({ limit: "1mb" }));
  app.use(express.json({ limit: "5mb" }));
  app.use(rejectUnsafeMongoKeys);
  app.use(cookieParser());
  app.use("/api", csrfGuard);

  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
  app.use("/api/uploads", express.static(uploadDir));

  app.get("/", (_req, res) => {
    res.json({
      service: "The Hundred Platform API",
      status: "running",
    });
  });

  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

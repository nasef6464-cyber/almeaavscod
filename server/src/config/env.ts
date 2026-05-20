import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanString = z.preprocess((val) => {
  if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
  return Boolean(val);
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: z.string().default(""),
  MONGODB_URI: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  USE_POSTGRES: booleanString.default(false),
  REDIS_URL: z.string().optional().default(""),
  REDIS_KEY_PREFIX: z.string().default("almeaa"),
  RATE_LIMIT_REDIS_ENABLED: booleanString.default(false),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().min(1000).max(60 * 60 * 1000).default(60 * 1000),
  RATE_LIMIT_GLOBAL_LIMIT: z.coerce.number().int().min(50).max(5000).default(600),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().min(30 * 1000).max(24 * 60 * 60 * 1000).default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_LIMIT: z.coerce.number().int().min(3).max(500).default(20),
  RATE_LIMIT_SENSITIVE_WINDOW_MS: z.coerce.number().int().min(1000).max(60 * 60 * 1000).default(60 * 1000),
  RATE_LIMIT_SENSITIVE_LIMIT: z.coerce.number().int().min(10).max(2000).default(60),
  NOTIFICATION_QUEUE_ENABLED: booleanString.default(false),
  NOTIFICATION_QUEUE_CONCURRENCY: z.coerce.number().int().min(1).max(25).default(5),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  PLATFORM_INTEGRATIONS_SECRET_KEY: z.string().optional().default(""),
  JWT_EXPIRES_IN: z.string().default("7d"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().optional().default(""),
  GOOGLE_OAUTH_ENABLED: booleanString.default(false),
  SENTRY_DSN: z.string().optional().default(""),
  SENTRY_ENVIRONMENT: z.string().optional().default("production"),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  DEV_LOCAL_ADMIN_BYPASS: booleanString.default(false),
  ADMIN_NAME: z.string().default("Platform Admin"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(6).default("change-me"),
  ADMIN_LOGIN_BYPASS_ENABLED: booleanString.default(false),
  ADMIN_LOGIN_BYPASS_EMAIL: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  }, z.string().email().optional()),
  ADMIN_LOGIN_BYPASS_IPS: z.string().default(""),
  AI_PROVIDER: z.preprocess((value) => {
    if (typeof value === "string" && value.trim() === "") return undefined;
    return value;
  }, z.enum(["gemini", "deepseek", "ollama", "lmstudio", "none"]).optional()),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com/v1"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("gemma3:4b"),
  LM_STUDIO_BASE_URL: z.string().default("http://127.0.0.1:1234/v1"),
  LM_STUDIO_MODEL: z.string().default("local-model"),
});

export const env = envSchema.parse(process.env);

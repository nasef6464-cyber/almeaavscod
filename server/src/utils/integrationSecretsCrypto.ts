import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ENCRYPTION_PREFIX = "enc::";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

const PROVIDER_SECRET_FIELDS = ["appSecret", "clientSecret", "apiKey", "accessToken", "botToken", "verifyToken"] as const;
const EXTERNAL_PLATFORM_SECRET_FIELDS = ["apiKey", "apiSecret", "webhookSecret"] as const;

const getKeyMaterial = () => {
  const source = String(env.PLATFORM_INTEGRATIONS_SECRET_KEY || env.JWT_SECRET || "").trim();
  return createHash("sha256").update(source).digest();
};

const isEncrypted = (value: string) => value.startsWith(ENCRYPTION_PREFIX);

const encryptValue = (plainText: string) => {
  if (!plainText) return "";
  if (isEncrypted(plainText)) return plainText;

  const key = getKeyMaterial();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${cipherText.toString("base64url")}`;
};

const decryptValue = (value: string) => {
  if (!value) return "";
  if (!isEncrypted(value)) return value;

  try {
    const payload = value.slice(ENCRYPTION_PREFIX.length);
    const [ivRaw, tagRaw, cipherRaw] = payload.split(".");
    if (!ivRaw || !tagRaw || !cipherRaw) return "";
    const key = getKeyMaterial();
    const iv = Buffer.from(ivRaw, "base64url");
    const tag = Buffer.from(tagRaw, "base64url");
    const cipherText = Buffer.from(cipherRaw, "base64url");
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return "";
  }
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const encryptIntegrationSecretsAtRest = (settings: Record<string, unknown>) => {
  const next = clone(settings) as Record<string, any>;
  const providers = (next.providers || {}) as Record<string, Record<string, unknown>>;
  Object.values(providers).forEach((provider) => {
    PROVIDER_SECRET_FIELDS.forEach((field) => {
      const current = String(provider[field] || "");
      if (current) {
        provider[field] = encryptValue(current);
      }
    });
  });

  const externalPlatforms = Array.isArray(next.externalPlatforms) ? next.externalPlatforms : [];
  externalPlatforms.forEach((platform: Record<string, unknown>) => {
    EXTERNAL_PLATFORM_SECRET_FIELDS.forEach((field) => {
      const current = String(platform[field] || "");
      if (current) {
        platform[field] = encryptValue(current);
      }
    });
  });
  next.externalPlatforms = externalPlatforms;

  return next;
};

export const decryptIntegrationSecretsForRuntime = (settings: Record<string, unknown>) => {
  const next = clone(settings) as Record<string, any>;
  const providers = (next.providers || {}) as Record<string, Record<string, unknown>>;
  Object.values(providers).forEach((provider) => {
    PROVIDER_SECRET_FIELDS.forEach((field) => {
      const current = String(provider[field] || "");
      if (current) {
        provider[field] = decryptValue(current);
      }
    });
  });

  const externalPlatforms = Array.isArray(next.externalPlatforms) ? next.externalPlatforms : [];
  externalPlatforms.forEach((platform: Record<string, unknown>) => {
    EXTERNAL_PLATFORM_SECRET_FIELDS.forEach((field) => {
      const current = String(platform[field] || "");
      if (current) {
        platform[field] = decryptValue(current);
      }
    });
  });
  next.externalPlatforms = externalPlatforms;

  return next;
};

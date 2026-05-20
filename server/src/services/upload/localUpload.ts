import { createWriteStream, mkdirSync, existsSync, createReadStream } from "node:fs";
import { join, extname, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { Request } from "express";

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "text/plain",
  "text/csv",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "text/plain": ".txt",
  "text/csv": ".csv",
};

function getSubDir(category: string): string {
  const now = new Date();
  return join(category, `${now.getFullYear()}`, `${String(now.getMonth() + 1).padStart(2, "0")}`);
}

function sanitizeFilename(original: string): string {
  return basename(original).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export async function handleFileUpload(req: Request, category: string = "general") {
  const file = (req as any).file;
  if (!file) {
    throw new Error("No file uploaded");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} is not allowed`);
  }

  const subDir = getSubDir(category);
  const fullDir = join(UPLOAD_DIR, subDir);
  if (!existsSync(fullDir)) {
    mkdirSync(fullDir, { recursive: true });
  }

  const ext = MIME_TO_EXT[file.mimetype] || extname(file.originalname) || ".bin";
  const filename = `${randomUUID()}${ext}`;
  const filepath = join(fullDir, filename);

  if (file.buffer) {
    const stream = createWriteStream(filepath);
    stream.write(file.buffer);
    stream.end();
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", reject);
    });
  } else if (file.filepath) {
    const readStream = createReadStream(file.filepath);
    const writeStream = createWriteStream(filepath);
    await pipeline(readStream, writeStream);
  } else {
    throw new Error("No file data available");
  }

  const url = `/api/uploads/${join(subDir, filename).replace(/\\/g, "/")}`;
  const size = file.size;

  return {
    filename,
    originalFilename: sanitizeFilename(file.originalname),
    mimetype: file.mimetype,
    size,
    url,
    category,
  };
}

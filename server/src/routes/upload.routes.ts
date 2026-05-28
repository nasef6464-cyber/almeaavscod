import { Router } from "express";
import multer, { FileFilterCallback } from "multer";
import type { Request } from "express";
import { StatusCodes } from "http-status-codes";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { handleFileUpload } from "../services/upload/localUpload.js";

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "10485760", 10);

const ALLOWED_MIME_TYPES = [
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
];

const fileFilter = (
  _req: Request,
  file: { mimetype: string; originalname: string },
  cb: FileFilterCallback,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const uploadRouter = Router();

uploadRouter.post(
  "/single/:category?",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const category = req.params.category || "general";
    const result = await handleFileUpload(req, category);
    return res.status(StatusCodes.CREATED).json({ file: result });
  }),
);

uploadRouter.post(
  "/multiple/:category?",
  requireAuth,
  upload.array("files", 10),
  asyncHandler(async (req, res) => {
    const category = req.params.category || "general";
    const files = (req as any).files as { originalname: string; mimetype: string; size: number; buffer: Buffer }[] | undefined;
    if (!files || files.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "No files uploaded" });
    }

    const results: Array<Record<string, unknown>> = [];
    for (const _file of files) {
      (req as any).file = _file;
      const result = await handleFileUpload(req, category);
      results.push(result);
    }

    return res.status(StatusCodes.CREATED).json({ files: results });
  }),
);

uploadRouter.post(
  "/avatar",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const result = await handleFileUpload(req, "avatars");
    return res.status(StatusCodes.CREATED).json({ file: result });
  }),
);

uploadRouter.post(
  "/course-thumbnail",
  requireAuth,
  requireRole(["admin", "teacher"]),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const result = await handleFileUpload(req, "thumbnails");
    return res.status(StatusCodes.CREATED).json({ file: result });
  }),
);

uploadRouter.post(
  "/lesson-content",
  requireAuth,
  requireRole(["admin", "teacher"]),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const result = await handleFileUpload(req, "lesson-content");
    return res.status(StatusCodes.CREATED).json({ file: result });
  }),
);

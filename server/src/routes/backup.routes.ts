import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { BackupSnapshotModel } from "../models/BackupSnapshot.js";
import { BackupActivityModel } from "../models/BackupActivity.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";
import {
  createBackup,
  restoreBackup,
  listBackups,
  deleteBackup,
  getBackupDetails,
} from "../services/backupService.js";
import { env } from "../config/env.js";

const USE_PG = () => env.USE_POSTGRES && env.DATABASE_URL;

export const backupRouter = Router();

backupRouter.get(
  "/snapshots",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const backups = await listBackups();
      return res.json({ data: backups, total: backups.length });
    }

    const snapshots = await BackupSnapshotModel.find().sort({ createdAt: -1 }).limit(50);
    const total = await BackupSnapshotModel.countDocuments();
    const { page, limit } = resolvePagination(req.query);
    return res.json(buildPaginatedResponse(snapshots, page, limit, total));
  }),
);

backupRouter.post(
  "/snapshots",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      tables: z.array(z.string()).optional(),
    });
    const payload = schema.parse(req.body);

    if (USE_PG()) {
      const result = await createBackup({
        ...payload,
        createdBy: req.authUser?.id,
      });

      await BackupActivityModel.create({
        id: `activity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        snapshotId: result.backupId,
        action: "snapshot_created",
        description: `Backup "${result.name}" created with ${result.recordCount} records`,
        status: "completed",
        createdBy: req.authUser?.id,
      });

      return res.status(StatusCodes.CREATED).json(result);
    }

    const snapshot = await BackupSnapshotModel.create({
      ...payload,
      createdBy: req.authUser?.id,
      status: "completed",
    });
    await BackupActivityModel.create({
      type: "snapshot_created",
      description: `Snapshot "${payload.name}" created`,
      userId: req.authUser?.id,
      snapshotId: String(snapshot._id),
      status: "completed",
    });
    return res.status(StatusCodes.CREATED).json(snapshot);
  }),
);

backupRouter.get(
  "/snapshots/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const details = await getBackupDetails(req.params.id);
      return res.json(details);
    }

    const snapshot = await BackupSnapshotModel.findOne({ id: req.params.id });
    if (!snapshot) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Snapshot not found" });
    }
    return res.json(snapshot);
  }),
);

backupRouter.delete(
  "/snapshots/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      await deleteBackup(req.params.id);
      return res.json({ success: true, message: "Backup deleted" });
    }

    await BackupSnapshotModel.findOneAndDelete({ id: req.params.id });
    return res.json({ success: true, message: "Snapshot deleted" });
  }),
);

backupRouter.post(
  "/snapshots/:id/restore",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      tables: z.array(z.string()).optional(),
      truncateFirst: z.boolean().optional().default(false),
    });
    const payload = schema.parse(req.body);

    if (USE_PG()) {
      const result = await restoreBackup(req.params.id, {
        ...payload,
        createdBy: req.authUser?.id,
      });

      await BackupActivityModel.create({
        id: `activity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        snapshotId: req.params.id,
        action: "restore_completed",
        description: `Backup restored: ${result.totalImported} records imported`,
        status: "completed",
        createdBy: req.authUser?.id,
      });

      return res.json(result);
    }

    return res.status(StatusCodes.NOT_IMPLEMENTED).json({
      message: "Restore is only available in PostgreSQL mode",
    });
  }),
);

backupRouter.get(
  "/activities",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    const activities = await BackupActivityModel.find().sort({ createdAt: -1 }).limit(100);
    return res.json({ activities });
  }),
);

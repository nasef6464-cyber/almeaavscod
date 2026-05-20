import mongoose, { Schema } from "mongoose";

const backupActivitySchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["learning-content"],
      default: "learning-content",
      index: true,
    },
    action: {
      type: String,
      enum: ["snapshot-created", "snapshot-deleted", "restore-preview", "restore-applied", "restore-safety-snapshot"],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    actorId: { type: String, default: "", index: true },
    actorEmail: { type: String, default: "" },
    snapshotId: { type: String, default: "", index: true },
    safetySnapshotId: { type: String, default: "", index: true },
    source: {
      type: String,
      enum: ["download", "server-snapshot", "uploaded-file", "system"],
      default: "system",
    },
    applied: { type: Boolean, default: false },
    replaced: { type: Boolean, default: false },
    summary: { type: Schema.Types.Mixed, default: {} },
    totalDocuments: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

backupActivitySchema.index({ createdAt: -1 });

export const BackupActivityModel = mongoose.model("BackupActivity", backupActivitySchema);

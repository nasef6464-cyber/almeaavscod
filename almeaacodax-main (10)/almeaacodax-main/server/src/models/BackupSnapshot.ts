import mongoose, { Schema } from "mongoose";

const backupSnapshotSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["learning-content"],
      default: "learning-content",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    createdBy: { type: String, default: "", index: true },
    createdByEmail: { type: String, default: "" },
    database: { type: String, default: "" },
    summary: { type: Schema.Types.Mixed, default: {} },
    totalDocuments: { type: Number, default: 0 },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
  },
);

backupSnapshotSchema.index({ createdAt: -1 });

export const BackupSnapshotModel = mongoose.model("BackupSnapshot", backupSnapshotSchema);

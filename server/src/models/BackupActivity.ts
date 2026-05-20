import mongoose, { Schema } from "mongoose";

const backupActivitySchema = new Schema(
  {
    type: { type: String, required: true },
    description: { type: String, default: "" },
    userId: { type: String },
    snapshotId: { type: String },
    status: { type: String, default: "completed" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const BackupActivityModel = mongoose.model("BackupActivity", backupActivitySchema);

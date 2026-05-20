import mongoose, { Schema } from "mongoose";

const backupSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    collections: { type: [String], default: [] },
    documentCount: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },
    createdBy: { type: String },
    status: { type: String, default: "completed" },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const BackupSnapshotModel = mongoose.model("BackupSnapshot", backupSnapshotSchema);

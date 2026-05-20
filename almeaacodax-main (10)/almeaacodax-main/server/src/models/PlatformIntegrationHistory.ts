import mongoose, { Schema } from "mongoose";

const platformIntegrationHistorySchema = new Schema(
  {
    settingsKey: { type: String, required: true, default: "default", index: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);

export const PlatformIntegrationHistoryModel = mongoose.model(
  "PlatformIntegrationHistory",
  platformIntegrationHistorySchema,
);

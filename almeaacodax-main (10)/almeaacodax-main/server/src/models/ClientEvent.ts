import mongoose, { Schema } from "mongoose";

const clientEventSchema = new Schema(
  {
    severity: {
      type: String,
      enum: ["info", "warning", "error"],
      default: "error",
      index: true,
    },
    source: {
      type: String,
      enum: ["app", "error-boundary", "unhandled-error", "unhandled-rejection", "video-player", "api", "manual"],
      default: "app",
      index: true,
    },
    message: { type: String, required: true, trim: true },
    stack: { type: String, default: "" },
    path: { type: String, default: "", index: true },
    appVersion: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    userId: { type: String, default: "", index: true },
    userEmail: { type: String, default: "" },
    role: { type: String, default: "", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    resolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: "" },
    resolvedByEmail: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

clientEventSchema.index({ createdAt: -1 });

export const ClientEventModel = mongoose.model("ClientEvent", clientEventSchema);

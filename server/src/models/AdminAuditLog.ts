import mongoose, { Schema } from "mongoose";

const adminAuditLogSchema = new Schema(
  {
    userId: { type: String, required: true },
    action: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: String },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

export const AdminAuditLogModel = mongoose.model("AdminAuditLog", adminAuditLogSchema);

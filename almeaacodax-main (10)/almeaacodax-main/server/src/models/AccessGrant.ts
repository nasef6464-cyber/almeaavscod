import mongoose, { Schema } from "mongoose";

const accessGrantSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    sourceType: {
      type: String,
      enum: ["payment_request", "payment_webhook", "access_code", "admin_manual", "membership"],
      required: true,
      index: true,
    },
    sourceId: { type: String, required: true, index: true },
    packageId: { type: String, default: "", index: true },
    courseIds: { type: [String], default: [] },
    contentTypes: {
      type: [String],
      enum: ["courses", "foundation", "banks", "tests", "library", "all"],
      default: ["all"],
    },
    pathIds: { type: [String], default: [] },
    subjectIds: { type: [String], default: [] },
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active", index: true },
    grantedBy: { type: String, default: "system" },
    grantedAt: { type: Number, default: () => Date.now(), index: true },
    expiresAt: { type: Number, default: null, index: true },
    revokedAt: { type: Number, default: null },
    revokedBy: { type: String, default: "" },
    revokeReason: { type: String, default: "" },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

accessGrantSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const safeRet = ret as Record<string, unknown>;
    delete safeRet.__v;
    return safeRet;
  },
});

accessGrantSchema.index({ userId: 1, status: 1, grantedAt: -1 });
accessGrantSchema.index({ userId: 1, packageId: 1, status: 1 });
accessGrantSchema.index({ userId: 1, contentTypes: 1, status: 1 });
accessGrantSchema.index({ userId: 1, pathIds: 1, status: 1 });
accessGrantSchema.index({ userId: 1, subjectIds: 1, status: 1 });
accessGrantSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true });
accessGrantSchema.index({ status: 1, expiresAt: 1 });
accessGrantSchema.index({ packageId: 1, status: 1, grantedAt: -1 });

export const AccessGrantModel = mongoose.model("AccessGrant", accessGrantSchema);

import mongoose, { Schema } from "mongoose";

const accessGrantSchema = new Schema(
  {
    userId: { type: String, required: true },
    grantType: { type: String, enum: ["course", "package", "path", "subject"], required: true },
    grantId: { type: String, required: true },
    grantedBy: { type: String },
    expiresAt: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

accessGrantSchema.index({ userId: 1, grantType: 1, grantId: 1 }, { unique: true });

export const AccessGrantModel = mongoose.model("AccessGrant", accessGrantSchema);

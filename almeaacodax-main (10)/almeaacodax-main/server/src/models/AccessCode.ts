import mongoose, { Schema } from "mongoose";

const accessCodeSchema = new Schema(
  {
    id: { type: String, index: true, sparse: true },
    code: { type: String, required: true, trim: true, unique: true },
    schoolId: { type: String, required: true, index: true },
    packageId: { type: String, required: true, index: true },
    maxUses: { type: Number, default: 1 },
    currentUses: { type: Number, default: 0 },
    expiresAt: { type: Number, required: true },
    createdAt: { type: Number, default: () => Date.now() },
  },
  {
    timestamps: true,
  },
);

accessCodeSchema.index({ schoolId: 1, packageId: 1, expiresAt: 1 });
accessCodeSchema.index({ packageId: 1, expiresAt: 1 });
accessCodeSchema.index({ expiresAt: 1 });

export const AccessCodeModel = mongoose.model("AccessCode", accessCodeSchema);

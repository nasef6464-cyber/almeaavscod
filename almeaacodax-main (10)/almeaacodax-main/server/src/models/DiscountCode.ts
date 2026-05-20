import mongoose, { Schema } from "mongoose";

const discountCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    label: { type: String, default: "" },
    type: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    value: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "paused", "expired"], default: "active", index: true },
    minAmount: { type: Number, default: 0 },
    maxRedemptions: { type: Number, default: 0 },
    currentRedemptions: { type: Number, default: 0 },
    startsAt: { type: Number, default: null },
    expiresAt: { type: Number, default: null },
    packageIds: { type: [String], default: [] },
    pathIds: { type: [String], default: [] },
    subjectIds: { type: [String], default: [] },
    contentTypes: { type: [String], default: [] },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true },
);

discountCodeSchema.index({ status: 1, expiresAt: 1 });
discountCodeSchema.index({ packageIds: 1, status: 1 });
discountCodeSchema.index({ pathIds: 1, status: 1 });
discountCodeSchema.index({ subjectIds: 1, status: 1 });
discountCodeSchema.index({ contentTypes: 1, status: 1 });

export const DiscountCodeModel = mongoose.model("DiscountCode", discountCodeSchema);

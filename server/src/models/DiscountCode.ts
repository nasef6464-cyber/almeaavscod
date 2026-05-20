import mongoose, { Schema } from "mongoose";

const discountCodeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    label: { type: String, default: "" },
    type: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    value: { type: Number, required: true },
    minAmount: { type: Number, default: 0 },
    maxRedemptions: { type: Number, default: 0 },
    currentRedemptions: { type: Number, default: 0 },
    startsAt: { type: Number },
    expiresAt: { type: Number },
    packageIds: { type: [String], default: [] },
    pathIds: { type: [String], default: [] },
    subjectIds: { type: [String], default: [] },
    contentTypes: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const DiscountCodeModel = mongoose.model("DiscountCode", discountCodeSchema);

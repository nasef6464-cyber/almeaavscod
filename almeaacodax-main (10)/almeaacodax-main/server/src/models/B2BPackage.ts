import mongoose, { Schema } from "mongoose";

const b2bPackageSchema = new Schema(
  {
    id: { type: String, index: true, sparse: true },
    schoolId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    assignedTeacherId: { type: String, default: "" },
    revenueSharePercentage: { type: Number, default: null },
    courseIds: { type: [String], default: [] },
    contentTypes: {
      type: [String],
      enum: ["courses", "foundation", "banks", "tests", "library", "all"],
      default: ["all"],
    },
    pathIds: { type: [String], default: [] },
    subjectIds: { type: [String], default: [] },
    type: { type: String, enum: ["free_access", "discounted"], default: "free_access" },
    discountPercentage: { type: Number, default: null },
    maxStudents: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "expired"], default: "active" },
    createdAt: { type: Number, default: () => Date.now() },
  },
  {
    timestamps: true,
  },
);

b2bPackageSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
b2bPackageSchema.index({ assignedTeacherId: 1, status: 1 });
b2bPackageSchema.index({ pathIds: 1, status: 1 });
b2bPackageSchema.index({ subjectIds: 1, status: 1 });
b2bPackageSchema.index({ contentTypes: 1, status: 1 });

export const B2BPackageModel = mongoose.model("B2BPackage", b2bPackageSchema);

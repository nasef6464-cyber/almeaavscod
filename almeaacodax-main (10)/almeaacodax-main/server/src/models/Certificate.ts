import mongoose, { Schema } from "mongoose";

const certificateSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    pathId: { type: String, default: "", index: true },
    issuedAt: { type: Date, required: true, default: Date.now, index: true },
    verificationCode: { type: String, required: true, unique: true, index: true },
    studentName: { type: String, required: true, trim: true },
    courseName: { type: String, required: true, trim: true },
    completionPercentage: { type: Number, required: true, min: 0, max: 100, default: 100 },
  },
  { timestamps: true },
);

certificateSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const CertificateModel = mongoose.model("Certificate", certificateSchema);


import mongoose, { Schema } from "mongoose";

const certificateSchema = new Schema(
  {
    userId: { type: String, required: true },
    courseId: { type: String, required: true },
    courseTitle: { type: String, required: true },
    certificateCode: { type: String, required: true, unique: true },
    issuedAt: { type: Date, default: Date.now },
    studentName: { type: String, required: true },
    instructorName: { type: String, default: "" },
    score: { type: Number },
    verified: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CertificateModel = mongoose.model("Certificate", certificateSchema);

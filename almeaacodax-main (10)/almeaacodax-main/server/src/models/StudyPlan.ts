import mongoose, { Schema } from "mongoose";

const studyPlanSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    pathId: { type: String, required: true, index: true },
    subjectIds: { type: [String], default: [] },
    courseIds: { type: [String], default: [] },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    skipCompletedQuizzes: { type: Boolean, default: true },
    offDays: { type: [String], default: [] },
    dailyMinutes: { type: Number, default: 90 },
    preferredStartTime: { type: String, default: "17:00" },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    timestamps: true,
  },
);

export const StudyPlanModel = mongoose.model("StudyPlan", studyPlanSchema);

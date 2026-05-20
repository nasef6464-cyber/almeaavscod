import mongoose, { Schema } from "mongoose";

const skillProgressSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    skillId: { type: String, required: true, index: true },
    skill: { type: String, default: "" },
    pathId: { type: String, default: "", index: true },
    subjectId: { type: String, default: "", index: true },
    sectionId: { type: String, default: "", index: true },
    mastery: { type: Number, default: 0 },
    status: { type: String, enum: ["weak", "average", "good", "mastered"], default: "weak", index: true },
    attempts: { type: Number, default: 0 },
    lastQuizId: { type: String, default: "" },
    lastQuizTitle: { type: String, default: "" },
    lastAttemptAt: { type: Date, default: () => new Date(), index: true },
    recommendedAction: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

skillProgressSchema.index({ userId: 1, skillId: 1 }, { unique: true });
skillProgressSchema.index({ userId: 1, status: 1, mastery: 1 });
skillProgressSchema.index({ subjectId: 1, status: 1, mastery: 1 });
skillProgressSchema.index({ pathId: 1, subjectId: 1, sectionId: 1 });

export const SkillProgressModel = mongoose.model("SkillProgress", skillProgressSchema);

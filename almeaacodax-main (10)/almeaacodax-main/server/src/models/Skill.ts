import mongoose, { Schema } from "mongoose";

const skillSchema = new Schema(
  {
    _id: { type: String, required: true },
    pathId: { type: String, required: true, index: true },
    subjectId: { type: String, required: true, index: true },
    sectionId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    lessonIds: { type: [String], default: [] },
    questionIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
);

skillSchema.index({ pathId: 1, subjectId: 1, sectionId: 1, createdAt: 1 });
skillSchema.index({ subjectId: 1, sectionId: 1, createdAt: 1 });

export const SkillModel = mongoose.model("Skill", skillSchema);

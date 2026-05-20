import mongoose, { Schema } from "mongoose";

const subjectSchema = new Schema(
  {
    _id: { type: String, required: true },
    pathId: { type: String, required: true, index: true },
    levelId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "" },
    color: { type: String, default: "indigo" },
    iconUrl: { type: String, default: "" },
    iconStyle: {
      type: String,
      enum: ["default", "modern", "minimal", "playful"],
      default: "default",
    },
    settings: {
      showCourses: { type: Boolean, default: true },
      showSkills: { type: Boolean, default: true },
      showBanks: { type: Boolean, default: true },
      showTests: { type: Boolean, default: true },
      showLibrary: { type: Boolean, default: true },
      lockSkillsForNonSubscribers: { type: Boolean, default: false },
      lockBanksForNonSubscribers: { type: Boolean, default: false },
      lockTestsForNonSubscribers: { type: Boolean, default: false },
      lockLibraryForNonSubscribers: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  },
);

subjectSchema.index({ pathId: 1, createdAt: 1 });
subjectSchema.index({ levelId: 1, createdAt: 1 });

export const SubjectModel = mongoose.model("Subject", subjectSchema);

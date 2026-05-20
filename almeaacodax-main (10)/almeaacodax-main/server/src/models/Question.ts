import mongoose, { Schema } from "mongoose";

const questionSchema = new Schema(
  {
    id: { type: String, index: true, sparse: true },
    text: { type: String, default: "", trim: true },
    options: { type: [String], default: [] },
    correctOptionIndex: { type: Number, default: 0 },
    explanation: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    skillIds: { type: [String], default: [] },
    pathId: { type: String, default: null },
    subject: { type: String, required: true, index: true },
    sectionId: { type: String, default: null },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    type: { type: String, enum: ["mcq", "true_false", "essay"], default: "mcq" },
    ownerType: { type: String, enum: ["platform", "teacher", "school"], default: "platform" },
    ownerId: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    assignedTeacherId: { type: String, default: "" },
    approvalStatus: { type: String, enum: ["draft", "pending_review", "approved", "rejected"], default: "draft", index: true },
    approvedBy: { type: String, default: "" },
    approvedAt: { type: Number, default: null },
    reviewerNotes: { type: String, default: "" },
    revenueSharePercentage: { type: Number, default: null },
  },
  {
    timestamps: true,
  },
);

questionSchema.index({ pathId: 1, subject: 1, sectionId: 1, approvalStatus: 1 });
questionSchema.index({ skillIds: 1, difficulty: 1 });
questionSchema.index({ ownerType: 1, ownerId: 1, approvalStatus: 1 });

export const QuestionModel = mongoose.model("Question", questionSchema);

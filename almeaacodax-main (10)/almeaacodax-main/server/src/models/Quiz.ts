import mongoose, { Schema } from "mongoose";

const quizSchema = new Schema(
  {
    id: { type: String, index: true, sparse: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    pathId: { type: String, required: true, index: true },
    subjectId: { type: String, required: true, index: true },
    sectionId: { type: String, default: null },
    type: { type: String, enum: ["quiz", "bank"], default: "quiz" },
    placement: { type: String, enum: ["training", "mock", "both"], default: undefined },
    showInTraining: { type: Boolean, default: undefined },
    showInMock: { type: Boolean, default: undefined },
    learningPlacements: {
      type: [
        {
          pathId: { type: String, required: true },
          subjectId: { type: String, default: "" },
          slot: { type: String, enum: ["training", "tests", "foundation", "course"], required: true },
          accessType: { type: String, enum: ["inherit", "free", "paid"], default: "inherit" },
          isVisible: { type: Boolean, default: true },
          order: { type: Number, default: 0 },
          createdAt: { type: Number, default: Date.now },
          updatedAt: { type: Number, default: Date.now },
        },
      ],
      default: [],
    },
    mode: { type: String, enum: ["regular", "saher", "central"], default: "regular" },
    settings: {
      showExplanations: { type: Boolean, default: true },
      showAnswers: { type: Boolean, default: true },
      showResultsReport: { type: Boolean, default: true },
      returnToSourceOnFinish: { type: Boolean, default: false },
      maxAttempts: { type: Number, default: 3 },
      passingScore: { type: Number, default: 60 },
      timeLimit: { type: Number, default: 60 },
      randomizeQuestions: { type: Boolean, default: true },
      showProgressBar: { type: Boolean, default: true },
      requireAnswerBeforeNext: { type: Boolean, default: false },
      allowQuestionReview: { type: Boolean, default: true },
      optionLayout: { type: String, enum: ["auto", "horizontal", "two_columns"], default: "auto" },
    },
    access: {
      type: {
        type: String,
        enum: ["free", "paid", "private", "course_only"],
        default: "free",
      },
      price: { type: Number, default: 0 },
      allowedGroupIds: { type: [String], default: [] },
    },
    questionIds: { type: [String], default: [] },
    mockExam: {
      enabled: { type: Boolean, default: false, index: true },
      pathId: { type: String, default: "" },
      sections: {
        type: [
          {
            id: { type: String, required: true },
            title: { type: String, required: true, trim: true },
            subjectId: { type: String, default: "" },
            questionIds: { type: [String], default: [] },
            timeLimit: { type: Number, default: null },
            order: { type: Number, default: 0 },
          },
        ],
        default: [],
      },
    },
    skillIds: { type: [String], default: [] },
    targetGroupIds: { type: [String], default: [] },
    targetUserIds: { type: [String], default: [] },
    dueDate: { type: String, default: null },
    isPublished: { type: Boolean, default: false },
    showOnPlatform: { type: Boolean, default: true },
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

quizSchema.index({ pathId: 1, subjectId: 1, type: 1, placement: 1, showOnPlatform: 1, isPublished: 1 });
quizSchema.index({ pathId: 1, subjectId: 1, mode: 1, showOnPlatform: 1, isPublished: 1 });
quizSchema.index({ pathId: 1, subjectId: 1, "learningPlacements.slot": 1, "learningPlacements.isVisible": 1 });
quizSchema.index({ pathId: 1, "mockExam.enabled": 1, showOnPlatform: 1, isPublished: 1 });
quizSchema.index({ targetGroupIds: 1, dueDate: 1 });
quizSchema.index({ targetUserIds: 1, dueDate: 1 });
quizSchema.index({ skillIds: 1, mode: 1 });
quizSchema.index({ ownerType: 1, ownerId: 1, approvalStatus: 1 });

export const QuizModel = mongoose.model("Quiz", quizSchema);

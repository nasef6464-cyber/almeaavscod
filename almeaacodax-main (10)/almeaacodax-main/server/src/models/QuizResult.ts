import mongoose, { Schema } from "mongoose";

const quizResultSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    quizId: { type: String, required: true, index: true },
    quizTitle: { type: String, required: true, trim: true },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    passed: { type: Boolean, default: false, index: true },
    attemptNumber: { type: Number, default: 1 },
    source: { type: String, default: "" },
    timeSpentSeconds: { type: Number, default: 0 },
    timeSpent: { type: String, default: "" },
    date: { type: String, default: "" },
    skillsAnalysis: { type: [Schema.Types.Mixed], default: [] },
    questionReview: { type: [Schema.Types.Mixed], default: [] },
    submissionKey: { type: String, default: undefined, unique: true, sparse: true, index: true },
  },
  {
    timestamps: true,
  },
);

quizResultSchema.index({ userId: 1, createdAt: -1 });
quizResultSchema.index({ quizId: 1, createdAt: -1 });
quizResultSchema.index({ userId: 1, quizId: 1, attemptNumber: 1 });
quizResultSchema.index({ "skillsAnalysis.skillId": 1, userId: 1 });
quizResultSchema.index({ "skillsAnalysis.subjectId": 1, createdAt: -1 });

export const QuizResultModel = mongoose.model("QuizResult", quizResultSchema);

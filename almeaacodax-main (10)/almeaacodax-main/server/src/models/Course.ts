import mongoose, { Schema } from "mongoose";

const moduleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    lessons: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false },
);

const assessmentSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    quizId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    phase: { type: String, enum: ["pre_course", "during_course", "final_course"], default: "during_course" },
    access: { type: String, enum: ["free_preview", "enrolled_paid"], default: "enrolled_paid" },
    showOnPlatform: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const courseSchema = new Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    thumbnail: { type: String, default: "" },
    instructor: { type: String, required: true, trim: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "SAR" },
    duration: { type: Number, default: 0 },
    level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
    rating: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    category: { type: String, default: "" },
    subject: { type: String, default: "" },
    pathId: { type: String, default: "", index: true },
    subjectId: { type: String, default: "", index: true },
    sectionId: { type: String, default: "" },
    features: { type: [String], default: [] },
    description: { type: String, default: "" },
    instructorBio: { type: String, default: "" },
    modules: { type: [moduleSchema], default: [] },
    assessments: { type: [assessmentSchema], default: [] },
    isPublished: { type: Boolean, default: false },
    showOnPlatform: { type: Boolean, default: true },
    isPackage: { type: Boolean, default: false },
    packageType: { type: String, enum: ["courses", "videos", "tests", "membership"], default: "courses" },
    packageContentTypes: {
      type: [String],
      enum: ["courses", "foundation", "banks", "tests", "library", "all"],
      default: ["courses"],
    },
    originalPrice: { type: Number, default: null },
    includedCourses: { type: [String], default: [] },
    prerequisiteCourseIds: { type: [String], default: [] },
    dripContentEnabled: { type: Boolean, default: false },
    certificateEnabled: { type: Boolean, default: false },
    skills: { type: [String], default: [] },
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

courseSchema.index({ pathId: 1, subjectId: 1, isPublished: 1, showOnPlatform: 1, createdAt: -1 });
courseSchema.index({ isPackage: 1, packageType: 1, isPublished: 1, showOnPlatform: 1, createdAt: -1 });
courseSchema.index({ packageContentTypes: 1, isPublished: 1, showOnPlatform: 1 });
courseSchema.index({ ownerType: 1, ownerId: 1, approvalStatus: 1, createdAt: -1 });
courseSchema.index({ assignedTeacherId: 1, approvalStatus: 1, createdAt: -1 });
courseSchema.index({ includedCourses: 1 });

export const CourseModel = mongoose.model("Course", courseSchema);

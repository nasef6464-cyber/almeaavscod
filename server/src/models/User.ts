import mongoose, { Schema } from "mongoose";
import { roles } from "../constants/roles.js";

const userSchema = new Schema(
  {
    googleId: { type: String, default: null },
  name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: "" },
    role: { type: String, enum: roles, default: "student" },
    points: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    subscription: {
      plan: { type: String, enum: ["free", "premium"], default: "free" },
      expiresAt: { type: Date },
      purchasedCourses: { type: [String], default: [] },
      purchasedPackages: { type: [String], default: [] },
    },
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpiresAt: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpiresAt: { type: Date },
    schoolId: { type: String, default: null },
    groupIds: { type: [String], default: [] },
    linkedStudentIds: { type: [String], default: [] },
    managedPathIds: { type: [String], default: [] },
    managedSubjectIds: { type: [String], default: [] },
    enrolledCourses: { type: [String], default: [] },
    enrolledPaths: { type: [String], default: [] },
    completedLessons: { type: [String], default: [] },
    favorites: { type: [String], default: [] },
    reviewLater: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ googleId: 1 }, { sparse: true });
userSchema.index({ emailVerificationToken: 1 }, { sparse: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ schoolId: 1 });

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const safeRet = ret as Record<string, unknown>;
    delete safeRet.passwordHash;
    delete safeRet.__v;
    return safeRet;
  },
});

export const UserModel = mongoose.model("User", userSchema);

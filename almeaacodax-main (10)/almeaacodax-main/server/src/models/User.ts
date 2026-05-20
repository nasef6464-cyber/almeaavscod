import mongoose, { Schema } from "mongoose";
import { roles } from "../constants/roles.js";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lastFailedLoginAt: { type: Number, default: null },
    loginLockedUntil: { type: Number, default: null, index: true },
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
    emailVerified: { type: Boolean, default: false, index: true },
    emailVerifiedAt: { type: Number, default: null },
    emailVerificationTokenHash: { type: String, default: "", index: true },
    emailVerificationExpiresAt: { type: Number, default: null },
    passwordResetTokenHash: { type: String, default: "", index: true },
    passwordResetExpiresAt: { type: Number, default: null },
    passwordResetUsedAt: { type: Number, default: null },
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

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const safeRet = ret as Record<string, unknown>;
    delete safeRet.passwordHash;
    delete safeRet.failedLoginAttempts;
    delete safeRet.lastFailedLoginAt;
    delete safeRet.loginLockedUntil;
    delete safeRet.emailVerificationTokenHash;
    delete safeRet.passwordResetTokenHash;
    delete safeRet.__v;
    return safeRet;
  },
});

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ schoolId: 1, role: 1, createdAt: -1 });
userSchema.index({ groupIds: 1, role: 1 });
userSchema.index({ linkedStudentIds: 1 });
userSchema.index({ managedPathIds: 1 });
userSchema.index({ managedSubjectIds: 1 });
userSchema.index({ "subscription.purchasedPackages": 1 });
userSchema.index({ "subscription.purchasedCourses": 1 });
userSchema.index({ emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 });
userSchema.index({ passwordResetTokenHash: 1, passwordResetExpiresAt: 1 });

export const UserModel = mongoose.model("User", userSchema);

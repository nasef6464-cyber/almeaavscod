import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { users } from "../db/schema/index.js";
import { UserModel } from "../models/User.js";
import { sendExternalNotification } from "./notificationProviders.js";

const USE_PG = () => process.env.USE_POSTGRES === "true" && !!process.env.DATABASE_URL;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function sendEmailVerification(userId: string) {
  const user = USE_PG()
    ? (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
    : await UserModel.findById(userId);

  if (!user) throw new Error("User not found");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  if (USE_PG()) {
    await db.update(users)
      .set({ emailVerificationToken: token, emailVerificationExpiresAt: expiresAt })
      .where(eq(users.id, userId));
  } else {
    await UserModel.findByIdAndUpdate(userId, {
      emailVerificationToken: token,
      emailVerificationExpiresAt: expiresAt,
    });
  }

  const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-email?token=${token}`;

  await sendExternalNotification({
    channel: "email",
    id: `email-verify-${userId}`,
    recipientEmail: user.email,
    subject: "تفعيل الحساب - منصة المئة التعليمية",
    title: "تفعيل الحساب",
    body: `مرحباً ${user.name}،\n\nلتفعيل حسابك، يرجى الضغط على الرابط التالي:\n${verificationUrl}\n\nهذا الرابط صالح لمدة 24 ساعة.\n\nإذا لم تقم بإنشاء حساب، يرجى تجاهل هذا البريد.`,
  });

  return { success: true, message: "Verification email sent" };
}

export async function verifyEmail(token: string) {
  if (USE_PG()) {
    const userRows = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
    const user = userRows[0];

    if (!user) {
      throw new Error("Invalid verification token");
    }

    if (user.emailVerificationExpiresAt && new Date(user.emailVerificationExpiresAt) < new Date()) {
      throw new Error("Verification token has expired");
    }

    await db.update(users)
      .set({ isEmailVerified: true, emailVerificationToken: null, emailVerificationExpiresAt: null })
      .where(eq(users.id, user.id));

    return { success: true, message: "Email verified successfully" };
  }

  const user = await UserModel.findOne({ emailVerificationToken: token });
  if (!user) throw new Error("Invalid verification token");
  if (user.emailVerificationExpiresAt && new Date(user.emailVerificationExpiresAt) < new Date()) {
    throw new Error("Verification token has expired");
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiresAt = undefined;
  await user.save();

  return { success: true, message: "Email verified successfully" };
}

export async function sendPasswordResetEmail(email: string) {
  const normalizedEmail = email.toLowerCase();
  const user = USE_PG()
    ? (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0]
    : await UserModel.findOne({ email: normalizedEmail });

  if (!user) {
    return { success: true, message: "If an account exists, a reset email has been sent" };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  if (USE_PG()) {
    await db.update(users)
      .set({ passwordResetToken: token, passwordResetExpiresAt: expiresAt })
      .where(eq(users.id, user.id));
  } else {
    await (user as any).updateOne({ passwordResetToken: token, passwordResetExpiresAt: expiresAt });
  }

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  await sendExternalNotification({
    channel: "email",
    id: `password-reset-${user.id}`,
    recipientEmail: user.email,
    subject: "إعادة تعيين كلمة المرور - منصة المئة التعليمية",
    title: "إعادة تعيين كلمة المرور",
    body: `مرحباً ${user.name}،\n\nلتعيين كلمة مرور جديدة، يرجى الضغط على الرابط التالي:\n${resetUrl}\n\nهذا الرابط صالح لمدة ساعة واحدة.\n\nإذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.`,
  });

  return { success: true, message: "If an account exists, a reset email has been sent" };
}

export async function resetPassword(token: string, newPassword: string) {
  if (USE_PG()) {
    const userRows = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);
    const user = userRows[0];

    if (!user) throw new Error("Invalid reset token");
    if (user.passwordResetExpiresAt && new Date(user.passwordResetExpiresAt) < new Date()) {
      throw new Error("Reset token has expired");
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(users)
      .set({ passwordHash, passwordResetToken: null, passwordResetExpiresAt: null })
      .where(eq(users.id, user.id));

    return { success: true, message: "Password reset successfully" };
  }

  const user = await UserModel.findOne({ passwordResetToken: token });
  if (!user) throw new Error("Invalid reset token");
  if (user.passwordResetExpiresAt && new Date(user.passwordResetExpiresAt) < new Date()) {
    throw new Error("Reset token has expired");
  }

  const bcrypt = await import("bcryptjs");
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordResetToken = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  return { success: true, message: "Password reset successfully" };
}

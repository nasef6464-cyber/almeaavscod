import { Router } from "express";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { eq, ilike, desc } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { db } from "../db/connection.js";
import { users, accessCodes as pgAccessCodes, b2bPackages as pgB2bPackages } from "../db/schema/index.js";
import { UserModel } from "../models/User.js";
import { AccessCodeModel } from "../models/AccessCode.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { requireAuth, requireRole, setAuthCookie, clearAuthCookie } from "../middleware/auth.js";
import { signAccessToken } from "../utils/jwt.js";
import { applyPurchaseToUser } from "../services/applyPurchaseToUser.js";
import { env } from "../config/env.js";
import { sendEmailVerification, verifyEmail, sendPasswordResetEmail, resetPassword } from "../services/authService.js";
import { authRateLimiter, sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { handleGoogleAuth, handleGoogleCallback, getGoogleAuthUrl } from "../services/googleAuthService.js";
import { issueCsrfToken } from "../middleware/csrf.js";

const USE_PG = () => env.USE_POSTGRES && env.DATABASE_URL;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const adminCreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["student", "teacher", "admin", "supervisor", "parent"]),
  linkedStudentIds: z.array(z.string()).optional(),
  managedPathIds: z.array(z.string()).optional(),
  managedSubjectIds: z.array(z.string()).optional(),
});

const adminUpdateUserSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().optional(),
  role: z.enum(["student", "teacher", "admin", "supervisor", "parent"]).optional(),
  isActive: z.boolean().optional(),
  schoolId: z.string().nullable().optional(),
  groupIds: z.array(z.string()).optional(),
  linkedStudentIds: z.array(z.string()).optional(),
  managedPathIds: z.array(z.string()).optional(),
  managedSubjectIds: z.array(z.string()).optional(),
});

const preferencesSchema = z.object({
  favorites: z.array(z.string()).optional(),
  reviewLater: z.array(z.string()).optional(),
});

const purchaseSchema = z.object({
  courseId: z.string().min(1).optional(),
  packageId: z.string().min(1).optional(),
  includedCourseIds: z.array(z.string()).optional(),
}).refine((payload) => payload.courseId || payload.packageId, {
  message: "Purchase payload is incomplete",
});

const redeemAccessCodeSchema = z.object({
  code: z.string().min(4),
});

const serializeUser = (user: any) => {
  const { passwordHash, __v, ...safeUser } = user;
  return safeUser;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildDocumentQuery = (value: string) =>
  mongoose.Types.ObjectId.isValid(value) ? { $or: [{ id: value }, { _id: value }] } : { id: value };

export const authRouter = Router();

authRouter.get(
  "/csrf-token",
  asyncHandler(async (_req, res) => {
    const token = issueCsrfToken(res);
    return res.json({ csrfToken: token });
  }),
);

authRouter.post(
  "/register",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const email = payload.email.toLowerCase();

    const exists = await (USE_PG()
      ? db.select().from(users).where(eq(users.email, email)).limit(1)
      : UserModel.findOne({ email }));
    const userExists = Array.isArray(exists) ? exists[0] : exists;

    if (userExists) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "Email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    if (USE_PG()) {
      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const [user] = await db.insert(users).values({
        id,
        name: payload.name,
        email,
        passwordHash,
        role: "student",
      }).returning();

      const token = signAccessToken({
        id: user.id,
        email: user.email,
        role: user.role as "student" | "teacher" | "admin" | "supervisor" | "parent",
        name: user.name,
      });

      setAuthCookie(res, token);

      return res.status(StatusCodes.CREATED).json({
        token,
        user: serializeUser(user),
      });
    }

    const user = await UserModel.create({
      name: payload.name,
      email,
      passwordHash,
      role: "student",
    });

    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    setAuthCookie(res, token);

    return res.status(StatusCodes.CREATED).json({
      token,
      user: serializeUser(user),
    });
  }),
);

authRouter.post(
  "/login",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.toLowerCase();

    const result = await (USE_PG()
      ? db.select().from(users).where(eq(users.email, email)).limit(1)
      : UserModel.findOne({ email }));
    const user = Array.isArray(result) ? result[0] : result;

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: "Invalid email or password",
      });
    }

    const valid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!valid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: "Invalid email or password",
      });
    }

    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: user.role as "student" | "teacher" | "admin" | "supervisor" | "parent",
      name: user.name,
    });

    setAuthCookie(res, token);

    return res.json({
      token,
      user: serializeUser(user),
    });
  }),
);

authRouter.post(
  "/admin/users",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = adminCreateUserSchema.parse(req.body);
    const email = payload.email.toLowerCase();
    const passwordHash = await bcrypt.hash(payload.password, 10);

    if (USE_PG()) {
      const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existing[0]) {
        const [updated] = await db.update(users)
          .set({
            name: payload.name,
            passwordHash,
            role: payload.role,
            isActive: true,
            linkedStudentIds: payload.linkedStudentIds || [],
            managedPathIds: payload.managedPathIds || [],
            managedSubjectIds: payload.managedSubjectIds || [],
          })
          .where(eq(users.id, existing[0].id))
          .returning();

        return res.status(StatusCodes.CREATED).json({ user: serializeUser(updated) });
      }

      const [user] = await db.insert(users).values({
        id,
        name: payload.name,
        email,
        passwordHash,
        role: payload.role,
        isActive: true,
        linkedStudentIds: payload.linkedStudentIds || [],
        managedPathIds: payload.managedPathIds || [],
        managedSubjectIds: payload.managedSubjectIds || [],
      }).returning();

      return res.status(StatusCodes.CREATED).json({ user: serializeUser(user) });
    }

    const user = await UserModel.findOneAndUpdate(
      { email },
      {
        name: payload.name,
        email,
        passwordHash,
        role: payload.role,
        isActive: true,
        linkedStudentIds: payload.linkedStudentIds || [],
        managedPathIds: payload.managedPathIds || [],
        managedSubjectIds: payload.managedSubjectIds || [],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return res.status(StatusCodes.CREATED).json({ user: serializeUser(user) });
  }),
);

authRouter.get(
  "/admin/users",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    if (USE_PG()) {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      return res.json({ users: allUsers.map(serializeUser) });
    }

    const allUsers = await UserModel.find().sort({ createdAt: -1 });
    return res.json({ users: allUsers.map(serializeUser) });
  }),
);

authRouter.patch(
  "/admin/users/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = adminUpdateUserSchema.parse(req.body);

    if (USE_PG()) {
      const [updated] = await db.update(users)
        .set(payload)
        .where(eq(users.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
      }

      return res.json({ user: serializeUser(updated) });
    }

    const updated = await UserModel.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true },
    );

    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    return res.json({ user: serializeUser(updated) });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.authUser?.id || "";

    if (USE_PG()) {
      const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const user = result[0];

      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
      }

      return res.json({ user: serializeUser(user) });
    }

    const user = await UserModel.findById(req.authUser?.id);

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    return res.json({ user: serializeUser(user) });
  }),
);

authRouter.patch(
  "/me/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = preferencesSchema.parse(req.body);
    const update: Record<string, string[]> = {};

    if (payload.favorites) {
      update.favorites = Array.from(new Set(payload.favorites));
    }

    if (payload.reviewLater) {
      update.reviewLater = Array.from(new Set(payload.reviewLater));
    }

    if (USE_PG()) {
      const [user] = await db.update(users)
        .set(update)
        .where(eq(users.id, req.authUser?.id || ""))
        .returning();

      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
      }

      return res.json({ user: serializeUser(user) });
    }

    const user = await UserModel.findByIdAndUpdate(
      req.authUser?.id,
      update,
      { new: true },
    );

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    return res.json({ user: serializeUser(user) });
  }),
);

authRouter.post(
  "/me/purchase",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = purchaseSchema.parse(req.body);
    const user = await applyPurchaseToUser(req.authUser?.id || "", payload);

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "User not found",
      });
    }

    return res.json({
      user: serializeUser(user),
    });
  }),
);

authRouter.post(
  "/me/redeem-access-code",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = redeemAccessCodeSchema.parse(req.body);
    const normalizedCode = payload.code.trim().toUpperCase();

    if (USE_PG()) {
      const userResult = await db.select().from(users).where(eq(users.id, req.authUser!.id)).limit(1);
      const user = userResult[0];
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
      }

      const codeRows = await db.select().from(pgAccessCodes).where(eq(pgAccessCodes.code, normalizedCode)).limit(1);
      const accessCode = codeRows[0];
      if (!accessCode) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "كود التفعيل غير موجود" });
      }

      if (accessCode.expiresAt <= Date.now()) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "انتهت صلاحية كود التفعيل" });
      }

      if ((accessCode.currentUses || 0) >= (accessCode.maxUses || 0)) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "تم استهلاك عدد التفعيلات المتاح لهذا الكود" });
      }

      const pkgRows = await db.select().from(pgB2bPackages).where(eq(pgB2bPackages.id, accessCode.packageId)).limit(1);
      const linkedPackage = pkgRows[0];
      if (!linkedPackage || linkedPackage.status !== "active") {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "الباقة المرتبطة بهذا الكود غير متاحة الآن" });
      }

      if ((user.purchasedPackages || []).includes(linkedPackage.id)) {
        return res.status(StatusCodes.CONFLICT).json({ message: "تم تفعيل هذه الباقة على الحساب بالفعل" });
      }

      const updatedUser = await applyPurchaseToUser(user.id, {
        packageId: linkedPackage.id,
        includedCourseIds: Array.isArray(linkedPackage.courseIds) ? linkedPackage.courseIds.map(String) : [],
      });

      await db.update(pgAccessCodes)
        .set({ currentUses: (accessCode.currentUses || 0) + 1 } as any)
        .where(eq(pgAccessCodes.id, accessCode.id));

      return res.json({ user: serializeUser(updatedUser), accessCode, package: linkedPackage });
    }

    const user = await UserModel.findById(req.authUser?.id);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "User not found",
      });
    }

    const accessCode = await AccessCodeModel.findOne({
      code: { $regex: new RegExp(`^${escapeRegExp(normalizedCode)}$`, "i") },
    });

    if (!accessCode) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "كود التفعيل غير موجود",
      });
    }

    if (accessCode.expiresAt <= Date.now()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "انتهت صلاحية كود التفعيل",
      });
    }

    if ((accessCode.currentUses || 0) >= (accessCode.maxUses || 0)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "تم استهلاك عدد التفعيلات المتاح لهذا الكود",
      });
    }

      const linkedPackage = await B2BPackageModel.findOne(buildDocumentQuery(accessCode.packageId));

    if (!linkedPackage || linkedPackage.status !== "active") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "الباقة المرتبطة بهذا الكود غير متاحة الآن",
      });
    }

    if ((user.subscription?.purchasedPackages || []).includes(String(linkedPackage.id || linkedPackage._id))) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "تم تفعيل هذه الباقة على الحساب بالفعل",
      });
    }

    const updatedUser = await applyPurchaseToUser(String(user._id), {
      packageId: String(linkedPackage.id || linkedPackage._id),
      includedCourseIds: Array.isArray(linkedPackage.courseIds) ? linkedPackage.courseIds.map(String) : [],
    });

    accessCode.currentUses = (accessCode.currentUses || 0) + 1;
    await accessCode.save();

    return res.json({
      user: serializeUser(updatedUser),
      accessCode,
      package: linkedPackage,
    });
  }),
);

authRouter.post(
  "/me/send-verification",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await sendEmailVerification(req.authUser!.id);
    return res.json(result);
  }),
);

authRouter.post(
  "/verify-email",
  sensitiveActionRateLimiter,
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    try {
      const result = await verifyEmail(token);
      return res.json(result);
    } catch (err) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: err instanceof Error ? err.message : "Invalid verification token",
      });
    }
  }),
);

authRouter.post(
  "/forgot-password",
  sensitiveActionRateLimiter,
  asyncHandler(async (req, res) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const result = await sendPasswordResetEmail(email);
    return res.json(result);
  }),
);

authRouter.post(
  "/reset-password",
  sensitiveActionRateLimiter,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = z.object({
      token: z.string(),
      newPassword: z.string().min(6),
    }).parse(req.body);
    try {
      const result = await resetPassword(token, newPassword);
      return res.json(result);
    } catch (err) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: err instanceof Error ? err.message : "Invalid reset token",
      });
    }
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    res.clearCookie("almeaa_csrf_token", { path: "/" });
    return res.status(StatusCodes.NO_CONTENT).send();
  }),
);

authRouter.get(
  "/google/url",
  asyncHandler(async (_req, res) => {
    const url = getGoogleAuthUrl();
    if (!url) {
      return res.status(StatusCodes.NOT_IMPLEMENTED).json({
        message: "Google OAuth is not configured",
      });
    }
    return res.json({ url });
  }),
);

authRouter.get(
  "/google/start",
  asyncHandler(async (req, res) => {
    const returnTo = (req.query.returnTo as string) || "/";
    const url = getGoogleAuthUrl(returnTo);
    if (!url) {
      return res.status(StatusCodes.NOT_IMPLEMENTED).json({
        message: "Google OAuth is not configured",
      });
    }
    return res.redirect(url);
  }),
);

authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code) {
      const frontendUrl = env.CLIENT_URL || "https://almeaavscod.vercel.app";
      return res.redirect(`${frontendUrl}#/?oauth_provider=google&oauth_error=missing_code`);
    }

    let returnTo = "/";
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
        if (decoded.returnTo) returnTo = decoded.returnTo;
      } catch {}
    }

    try {
      const result = await handleGoogleCallback(code);
      setAuthCookie(res, result.token);
      const frontendUrl = env.CLIENT_URL || "https://almeaavscod.vercel.app";
      const redirectUrl = `${frontendUrl}#/?oauth_provider=google&oauth_return=${encodeURIComponent(returnTo)}`;
      return res.redirect(redirectUrl);
    } catch (err) {
      const frontendUrl = env.CLIENT_URL || "https://almeaavscod.vercel.app";
      const errorMsg = err instanceof Error ? err.message : "google_auth_failed";
      return res.redirect(`${frontendUrl}#/?oauth_provider=google&oauth_error=${encodeURIComponent(errorMsg)}`);
    }
  }),
);

authRouter.post(
  "/google/callback",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);

    try {
      const result = await handleGoogleAuth(idToken);
      return res.json(result);
    } catch (err) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        message: err instanceof Error ? err.message : "Google authentication failed",
      });
    }
  }),
);

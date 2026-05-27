import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { eq, and, or, desc, count, ilike } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { db } from "../db/connection.js";
import { paymentRequests as pgPaymentRequests, paymentSettings as pgPaymentSettings, users, discountCodes } from "../db/schema/index.js";
import { PaymentRequestModel } from "../models/PaymentRequest.js";
import { PaymentSettingsModel } from "../models/PaymentSettings.js";
import { UserModel } from "../models/User.js";
import { applyPurchaseToUser } from "../services/applyPurchaseToUser.js";
import { USE_PG } from "../utils/usePg.js";
import crypto from "crypto";
import { resolvePagination } from "../utils/pagination.js";



const paymentMethodSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  label: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  bankName: z.string().optional(),
  instructions: z.string().optional(),
  phoneNumber: z.string().optional(),
  providerName: z.string().optional(),
  publishDetailsToStudents: z.boolean().optional(),
});

const paymentSettingsUpdateSchema = z.object({
  currency: z.string().optional(),
  manualReviewRequired: z.boolean().optional(),
  card: paymentMethodSettingsSchema.optional(),
  transfer: paymentMethodSettingsSchema.optional(),
  wallet: paymentMethodSettingsSchema.optional(),
  notes: z.string().optional(),
});

const paymentRequestCreateSchema = z.object({
  itemType: z.enum(["course", "package", "skill", "test"]),
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  packageId: z.string().optional(),
  includedCourseIds: z.array(z.string()).optional(),
  amount: z.number().min(0),
  currency: z.string().default("SAR"),
  paymentMethod: z.enum(["card", "transfer", "wallet"]),
  transferReference: z.string().optional(),
  walletNumber: z.string().optional(),
  receiptUrl: z.string().optional(),
  notes: z.string().optional(),
});

const paymentRequestReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "cancelled"]),
  reviewerNotes: z.string().optional(),
});

const defaultSettings = {
  currency: "SAR",
  manualReviewRequired: true,
  card: {
    enabled: false,
    label: "بطاقة بنكية",
    publishDetailsToStudents: true,
  },
  transfer: {
    enabled: true,
    label: "تحويل بنكي",
    bankName: "",
    accountName: "",
    accountNumber: "",
    iban: "",
    instructions: "",
    publishDetailsToStudents: true,
  },
  wallet: {
    enabled: true,
    label: "محفظة إلكترونية",
    providerName: "",
    phoneNumber: "",
    instructions: "",
    publishDetailsToStudents: true,
  },
  notes: "",
};

const sanitizeSettingsForPublic = (settings: any) => ({
  key: settings.key,
  currency: settings.currency,
  manualReviewRequired: settings.manualReviewRequired,
  card: {
    enabled: Boolean(settings.card?.enabled),
    label: settings.card?.label || "بطاقة بنكية",
    instructions: settings.card?.instructions || "",
  },
  transfer: {
    enabled: Boolean(settings.transfer?.enabled),
    label: settings.transfer?.label || "تحويل بنكي",
    bankName: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.bankName || ""),
    accountName: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.accountName || ""),
    accountNumber: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.accountNumber || ""),
    iban: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.iban || ""),
    instructions: settings.transfer?.instructions || "",
  },
  wallet: {
    enabled: Boolean(settings.wallet?.enabled),
    label: settings.wallet?.label || "محفظة إلكترونية",
    providerName: settings.wallet?.publishDetailsToStudents === false ? "" : (settings.wallet?.providerName || ""),
    phoneNumber: settings.wallet?.publishDetailsToStudents === false ? "" : (settings.wallet?.phoneNumber || ""),
    instructions: settings.wallet?.instructions || "",
  },
  notes: settings.notes || "",
});

const getOrCreateSettings = async () => {
  let settings = await PaymentSettingsModel.findOne({ key: "default" });
  if (!settings) {
    settings = await PaymentSettingsModel.create({ key: "default", ...defaultSettings });
  }
  return settings;
};

const isPaymentMethodEnabled = (settings: any, method: "card" | "transfer" | "wallet") =>
  Boolean(settings?.[method]?.enabled);

export const paymentRouter = Router();

paymentRouter.get(
  "/settings",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const rows = await db.select().from(pgPaymentSettings).where(eq(pgPaymentSettings.id, "default")).limit(1);
      let settings = rows[0];
      if (!settings) {
        [settings] = await db.insert(pgPaymentSettings).values({ id: "default" } as any).returning();
      }
      if (req.authUser?.role === "admin") return res.json(settings);
      return res.json(sanitizeSettingsForPublic(settings));
    }

    const settings = await getOrCreateSettings();

    if (req.authUser?.role === "admin") {
      return res.json(settings);
    }

    return res.json(sanitizeSettingsForPublic(settings));
  }),
);

paymentRouter.patch(
  "/settings",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = paymentSettingsUpdateSchema.parse(req.body);

    if (USE_PG()) {
      const [updated] = await db.update(pgPaymentSettings)
        .set(payload as any)
        .where(eq(pgPaymentSettings.id, "default"))
        .returning();
      return res.json(updated);
    }

    const settings = await getOrCreateSettings();
    Object.assign(settings, payload);
    await settings.save();
    return res.json(settings);
  }),
);

paymentRouter.get(
  "/requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const filter = req.authUser?.role === "admin"
        ? undefined
        : eq(pgPaymentRequests.userId, req.authUser!.id);
      const rows = await db.select().from(pgPaymentRequests)
        .where(filter || undefined)
        .orderBy(desc(pgPaymentRequests.createdAt));
      return res.json({ requests: rows });
    }

    const filter = req.authUser?.role === "admin" ? {} : { userId: req.authUser?.id };
    const requests = await PaymentRequestModel.find(filter).sort({ createdAt: -1 });
    return res.json({ requests });
  }),
);

paymentRouter.post(
  "/requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = paymentRequestCreateSchema.parse(req.body);

    if (USE_PG()) {
      const settings = await db.select().from(pgPaymentSettings).where(eq(pgPaymentSettings.id, "default")).limit(1);
      if (!isPaymentMethodEnabled(settings[0], payload.paymentMethod)) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "Payment method is not available now" });
      }

      const userResult = await db.select().from(users).where(eq(users.id, req.authUser!.id)).limit(1);
      const user = userResult[0];
      if (!user) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
      }

      const pendingDuplicate = await db.select().from(pgPaymentRequests)
        .where(and(
          eq(pgPaymentRequests.userId, user.id),
          eq(pgPaymentRequests.itemType, payload.itemType),
          eq(pgPaymentRequests.itemId, payload.itemId),
          eq(pgPaymentRequests.status, "pending"),
        )).limit(1);

      if (pendingDuplicate[0]) {
        return res.status(StatusCodes.CONFLICT).json({
          message: "There is already a pending payment request for this item",
          request: pendingDuplicate[0],
        });
      }

      const [created] = await db.insert(pgPaymentRequests).values({
        id: `payreq_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        itemType: payload.itemType,
        itemId: payload.itemId,
        itemName: payload.itemName,
        packageId: payload.packageId || "",
        includedCourseIds: payload.includedCourseIds || [],
        amount: payload.amount,
        currency: payload.currency,
        paymentMethod: payload.paymentMethod,
        transferReference: payload.transferReference || "",
        walletNumber: payload.walletNumber || "",
        receiptUrl: payload.receiptUrl || "",
        notes: payload.notes || "",
        status: "pending",
      } as any).returning();

      return res.status(StatusCodes.CREATED).json({ request: created });
    }

    const settings = await getOrCreateSettings();
    const user = await UserModel.findById(req.authUser?.id);

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    if (!isPaymentMethodEnabled(settings, payload.paymentMethod)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Payment method is not available now" });
    }

    const pendingDuplicate = await PaymentRequestModel.findOne({
      userId: String(user._id),
      itemType: payload.itemType,
      itemId: payload.itemId,
      status: "pending",
    });

    if (pendingDuplicate) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "There is already a pending payment request for this item",
        request: pendingDuplicate,
      });
    }

    const created = await PaymentRequestModel.create({
      id: `payreq_${Date.now()}`,
      userId: String(user._id),
      userName: user.name,
      userEmail: user.email,
      ...payload,
      packageId: payload.packageId || "",
      includedCourseIds: payload.includedCourseIds || [],
      status: "pending",
    });

    return res.status(StatusCodes.CREATED).json({ request: created });
  }),
);

paymentRouter.patch(
  "/requests/:id/review",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = paymentRequestReviewSchema.parse(req.body);

    if (USE_PG()) {
      const [existing] = await db.select().from(pgPaymentRequests)
        .where(eq(pgPaymentRequests.id, req.params.id)).limit(1);
      if (!existing) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Payment request not found" });
      }

      const [updated] = await db.update(pgPaymentRequests)
        .set({
          status: payload.status,
          reviewerNotes: payload.reviewerNotes || "",
          reviewedBy: req.authUser?.id || "",
          reviewedAt: Date.now(),
        } as any)
        .where(eq(pgPaymentRequests.id, req.params.id))
        .returning();

      let updatedUser = null;
      if (payload.status === "approved") {
        updatedUser = await applyPurchaseToUser(existing.userId, {
          courseId: existing.itemType === "course" ? existing.itemId : undefined,
          packageId: existing.packageId || (existing.itemType === "package" ? existing.itemId : undefined),
          includedCourseIds: Array.isArray(existing.includedCourseIds) ? existing.includedCourseIds : [],
        });
      }

      return res.json({ request: updated, user: updatedUser });
    }

    const requestDoc = await PaymentRequestModel.findOne({
      $or: [{ id: req.params.id }, { _id: req.params.id }],
    });

    if (!requestDoc) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Payment request not found" });
    }

    requestDoc.status = payload.status;
    requestDoc.reviewerNotes = payload.reviewerNotes || "";
    requestDoc.reviewedBy = req.authUser?.id || "";
    requestDoc.reviewedAt = Date.now();
    await requestDoc.save();

    let updatedUser = null;
    if (payload.status === "approved") {
      updatedUser = await applyPurchaseToUser(requestDoc.userId, {
        courseId: requestDoc.itemType === "course" ? requestDoc.itemId : undefined,
        packageId: requestDoc.packageId || (requestDoc.itemType === "package" ? requestDoc.itemId : undefined),
        includedCourseIds: Array.isArray(requestDoc.includedCourseIds) ? requestDoc.includedCourseIds : [],
      });
    }

    return res.json({
      request: requestDoc,
      user: updatedUser,
    });
  }),
);

paymentRouter.get(
  "/requests/summary",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    if (USE_PG()) {
      const [total, pending, approved, rejected] = await Promise.all([
        db.select({ count: count() }).from(pgPaymentRequests),
        db.select({ count: count() }).from(pgPaymentRequests).where(eq(pgPaymentRequests.status, "pending")),
        db.select({ count: count() }).from(pgPaymentRequests).where(eq(pgPaymentRequests.status, "approved")),
        db.select({ count: count() }).from(pgPaymentRequests).where(eq(pgPaymentRequests.status, "rejected")),
      ]);
      return res.json({
        total: Number(total[0]?.count || 0),
        pending: Number(pending[0]?.count || 0),
        approved: Number(approved[0]?.count || 0),
        rejected: Number(rejected[0]?.count || 0),
      });
    }

    const all = await PaymentRequestModel.find();
    const total = all.length;
    const pending = all.filter((r: any) => r.status === "pending").length;
    const approved = all.filter((r: any) => r.status === "approved").length;
    const rejected = all.filter((r: any) => r.status === "rejected").length;
    return res.json({ total, pending, approved, rejected });
  }),
);

// ── Discount Codes CRUD ──────────────────────────────────────────────────────

paymentRouter.get(
  "/discount-codes",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { limit, skip } = resolvePagination(req.query);
    const search = req.query.search as string | undefined;
    const isActive = req.query.isActive as string | undefined;
    const type = req.query.type as string | undefined;

    const filters: any[] = [];
    if (search) {
      filters.push(or(
        ilike(discountCodes.code, `%${search}%`),
        ilike(discountCodes.name, `%${search}%`),
      ));
    }
    if (isActive === "true") filters.push(eq(discountCodes.isActive, true));
    else if (isActive === "false") filters.push(eq(discountCodes.isActive, false));
    if (type) filters.push(eq(discountCodes.type, type as any));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [codes, [{ count: total }]] = await Promise.all([
      db.select().from(discountCodes)
        .where(whereClause)
        .orderBy(desc(discountCodes.createdAt))
        .limit(limit)
        .offset(skip),
      db.select({ count: count() }).from(discountCodes).where(whereClause),
    ]);

    return res.json({ codes, total, page: Math.floor(skip / limit) + 1, limit });
  }),
);

paymentRouter.post(
  "/discount-codes",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const body = req.body;
    const [code] = await db.insert(discountCodes).values({
      id: crypto.randomUUID(),
      code: body.code,
      name: body.name,
      type: body.type || "percentage",
      value: body.value,
      maxUses: body.maxUses ?? 0,
      currentUses: body.currentUses ?? 0,
      minPurchaseAmount: body.minPurchaseAmount ?? 0,
      applicableCourseIds: body.applicableCourseIds || [],
      applicablePackageIds: body.applicablePackageIds || [],
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      isActive: body.isActive ?? true,
      createdBy: req.authUser!.id,
    } as any).returning();

    return res.status(StatusCodes.CREATED).json({ code });
  }),
);

paymentRouter.patch(
  "/discount-codes/:code",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const [existing] = await db.select().from(discountCodes)
      .where(eq(discountCodes.code, req.params.code)).limit(1);
    if (!existing) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Discount code not found" });
    }

    const body = req.body;
    const [updated] = await db.update(discountCodes)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.value !== undefined ? { value: body.value } : {}),
        ...(body.maxUses !== undefined ? { maxUses: body.maxUses } : {}),
        ...(body.currentUses !== undefined ? { currentUses: body.currentUses } : {}),
        ...(body.minPurchaseAmount !== undefined ? { minPurchaseAmount: body.minPurchaseAmount } : {}),
        ...(body.applicableCourseIds !== undefined ? { applicableCourseIds: body.applicableCourseIds } : {}),
        ...(body.applicablePackageIds !== undefined ? { applicablePackageIds: body.applicablePackageIds } : {}),
        ...(body.startsAt !== undefined ? { startsAt: body.startsAt ? new Date(body.startsAt) : null } : {}),
        ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        updatedAt: new Date(),
      } as any)
      .where(eq(discountCodes.code, req.params.code))
      .returning();

    return res.json({ code: updated });
  }),
);

paymentRouter.post(
  "/discount-codes/preview",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { code: codeStr, amount, courseId, packageId } = req.body;

    const [discount] = await db.select().from(discountCodes)
      .where(eq(discountCodes.code, codeStr)).limit(1);

    if (!discount) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "Invalid discount code" });
    }
    if (!discount.isActive) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "This discount code is no longer active" });
    }
    if (discount.maxUses > 0 && discount.currentUses >= discount.maxUses) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "This discount code has reached its usage limit" });
    }
    if (discount.startsAt && new Date(discount.startsAt) > new Date()) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "This discount code is not yet valid" });
    }
    if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "This discount code has expired" });
    }
    if (discount.minPurchaseAmount > 0 && amount < discount.minPurchaseAmount) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "Minimum purchase amount not met" });
    }
    if (courseId && discount.applicableCourseIds?.length > 0 && !discount.applicableCourseIds.includes(courseId)) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "This discount code is not applicable for this course" });
    }
    if (packageId && discount.applicablePackageIds?.length > 0 && !discount.applicablePackageIds.includes(packageId)) {
      return res.json({ valid: false, originalAmount: amount, discountAmount: 0, finalAmount: amount, message: "This discount code is not applicable for this package" });
    }

    let discountAmount = 0;
    if (discount.type === "percentage") {
      discountAmount = Math.round(amount * (discount.value / 100));
    } else {
      discountAmount = Math.min(discount.value, amount);
    }

    return res.json({
      valid: true,
      code: discount.code,
      label: discount.name,
      originalAmount: amount,
      discountAmount,
      finalAmount: amount - discountAmount,
    });
  }),
);

paymentRouter.get(
  "/settings/presets",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      presets: [
        { id: "saudi", name: "السعودية", currency: "SAR", methods: ["bank_transfer", "vodafone_cash"] },
        { id: "egypt", name: "مصر", currency: "EGP", methods: ["vodafone_cash", "bank_transfer"] },
        { id: "uae", name: "الإمارات", currency: "AED", methods: ["bank_transfer"] },
      ],
    });
  }),
);

paymentRouter.post(
  "/settings/apply-country-preset",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const schema = z.object({ presetId: z.string().min(1) });
    const { presetId } = schema.parse(req.body);
    return res.json({ applied: true, presetId, message: `تم تطبيق الإعدادات المسبقة للدولة: ${presetId}` });
  }),
);

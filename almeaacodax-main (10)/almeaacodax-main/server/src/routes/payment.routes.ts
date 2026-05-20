import { Router } from "express";
import crypto from "node:crypto";
import { StatusCodes } from "http-status-codes";
import { Types } from "mongoose";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { CourseModel } from "../models/Course.js";
import { DiscountCodeModel } from "../models/DiscountCode.js";
import { PaymentRequestModel } from "../models/PaymentRequest.js";
import { PaymentSettingsModel } from "../models/PaymentSettings.js";
import { UserModel } from "../models/User.js";
import { grantAccessToUser } from "../services/accessGrantService.js";
import { recordAdminAuditLog } from "../services/adminAuditLog.js";
import { buildPaginatedResponse, resolvePagination } from "../utils/pagination.js";

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
  providerCode: z.string().max(80).optional(),
  gatewayMode: z.enum(["manual_review", "payment_link", "webhook"]).optional(),
  supportedCountries: z.array(z.string().max(3)).optional(),
  publishDetailsToStudents: z.boolean().optional(),
});

const paymentSettingsUpdateSchema = z.object({
  currency: z.string().optional(),
  manualReviewRequired: z.boolean().optional(),
  webhookEnabled: z.boolean().optional(),
  webhookSecret: z.string().max(240).optional(),
  card: paymentMethodSettingsSchema.optional(),
  transfer: paymentMethodSettingsSchema.optional(),
  wallet: paymentMethodSettingsSchema.optional(),
  notes: z.string().optional(),
});

const paymentCountryPresetSchema = z.object({
  country: z.enum(["SA", "EG"]),
});

const paymentRequestCreateSchema = z.object({
  itemType: z.enum(["course", "package", "skill", "test"]),
  itemId: z.string().min(1),
  packageId: z.string().optional(),
  paymentMethod: z.enum(["card", "transfer", "wallet"]),
  transferReference: z.string().optional(),
  walletNumber: z.string().optional(),
  receiptUrl: z.string().optional(),
  discountCode: z.string().max(80).optional(),
  paymentProviderCode: z.string().max(80).optional(),
  paymentGatewayMode: z.enum(["manual_review", "payment_link", "webhook"]).optional(),
  paymentCountry: z.string().max(3).optional(),
  notes: z.string().optional(),
});

const paymentRequestReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "cancelled"]),
  reviewerNotes: z.string().optional(),
  approvalEvidence: z.string().max(500).optional(),
});

const paymentWebhookSchema = z.object({
  provider: z.string().min(1).max(40).default("gateway"),
  eventId: z.string().min(1).max(160),
  paymentRequestId: z.string().min(1).max(160),
  status: z.enum(["paid", "failed", "cancelled"]),
  paidAmount: z.number().min(0).optional(),
  currency: z.string().max(10).optional(),
  transactionId: z.string().max(180).optional(),
  occurredAt: z.number().optional(),
});

const paymentRequestListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled", "all"]).optional(),
  search: z.string().max(120).optional(),
  paymentCountry: z.string().max(3).optional(),
  paymentMethod: z.enum(["card", "transfer", "wallet", "all"]).optional(),
});

const discountCodeListQuerySchema = z.object({
  status: z.enum(["active", "paused", "expired", "all"]).optional(),
  search: z.string().max(80).optional(),
});

const discountCodePayloadSchema = z.object({
  code: z.string().min(2).max(40),
  label: z.string().max(120).optional(),
  type: z.enum(["percentage", "fixed"]).default("percentage"),
  value: z.number().min(0),
  status: z.enum(["active", "paused", "expired"]).default("active"),
  minAmount: z.number().min(0).optional(),
  maxRedemptions: z.number().min(0).optional(),
  startsAt: z.number().nullable().optional(),
  expiresAt: z.number().nullable().optional(),
  packageIds: z.array(z.string()).optional(),
  pathIds: z.array(z.string()).optional(),
  subjectIds: z.array(z.string()).optional(),
  contentTypes: z.array(z.string()).optional(),
});

const discountCodePreviewSchema = z.object({
  itemType: z.enum(["course", "package", "skill", "test"]).optional(),
  itemId: z.string().min(1),
  packageId: z.string().optional(),
  discountCode: z.string().max(80),
});

const defaultSettings = {
  currency: "SAR",
  manualReviewRequired: true,
  webhookEnabled: false,
  webhookSecret: "",
  card: {
    enabled: false,
    label: "????? ?????",
    providerName: "Tap / MyFatoorah / HyperPay / Paymob / Fawry",
    providerCode: "manual_card",
    gatewayMode: "manual_review",
    supportedCountries: ["SA", "EG"],
    publishDetailsToStudents: true,
  },
  transfer: {
    enabled: true,
    label: "????? ????",
    bankName: "",
    accountName: "",
    accountNumber: "",
    iban: "",
    instructions: "",
    providerName: "Bank transfer",
    providerCode: "manual_transfer",
    gatewayMode: "manual_review",
    supportedCountries: ["SA", "EG"],
    publishDetailsToStudents: true,
  },
  wallet: {
    enabled: true,
    label: "????? ?????????",
    providerName: "",
    providerCode: "manual_wallet",
    gatewayMode: "manual_review",
    supportedCountries: ["SA", "EG"],
    phoneNumber: "",
    instructions: "",
    publishDetailsToStudents: true,
  },
  notes: "",
};

const paymentCountryPresets = {
  SA: {
    currency: "SAR",
    card: {
      enabled: true,
      providerName: "Tap / MyFatoorah / HyperPay",
      providerCode: "tap",
      gatewayMode: "payment_link" as const,
      supportedCountries: ["SA"],
    },
    transfer: {
      enabled: true,
      providerName: "Bank transfer",
      providerCode: "manual_transfer",
      gatewayMode: "manual_review" as const,
      supportedCountries: ["SA"],
    },
    wallet: {
      enabled: true,
      providerName: "STC Pay",
      providerCode: "stc_pay",
      gatewayMode: "manual_review" as const,
      supportedCountries: ["SA"],
    },
  },
  EG: {
    currency: "EGP",
    card: {
      enabled: true,
      providerName: "Paymob / Fawry",
      providerCode: "paymob",
      gatewayMode: "payment_link" as const,
      supportedCountries: ["EG"],
    },
    transfer: {
      enabled: true,
      providerName: "Bank transfer",
      providerCode: "manual_transfer",
      gatewayMode: "manual_review" as const,
      supportedCountries: ["EG"],
    },
    wallet: {
      enabled: true,
      providerName: "Vodafone Cash / Fawry Wallet",
      providerCode: "vodafone_cash",
      gatewayMode: "manual_review" as const,
      supportedCountries: ["EG"],
    },
  },
};

const PAYMENT_ERRORS = {
  courseAsPackage: "لا يمكن إرسال دورة على أنها باقة",
  packageAsCourse: "لا يمكن إرسال باقة على أنها دورة",
  packageRequiredForSkillOrTest: "العنصر المحدد يحتاج باقة صالحة.",
  paymentMethodUnavailableForCountry: "وسيلة الدفع غير متاحة لهذه الدولة حاليًا",
  missingPurchaseUserForApproval: "لا يمكن اعتماد طلب دفع لمستخدم غير موجود",
  discountApprovalFailedDuringReview: "تعذر اعتماد كود الخصم أثناء المراجعة",
  discountNoLongerAvailableForApproval: "كود الخصم لم يعد متاحًا للاعتماد",
} as const;

const sanitizeSettingsForPublic = (settings: any) => ({
  key: settings.key,
  currency: settings.currency,
  manualReviewRequired: settings.manualReviewRequired,
  card: {
    enabled: Boolean(settings.card?.enabled),
    label: settings.card?.label || "????? ?????",
    providerName: settings.card?.publishDetailsToStudents === false ? "" : (settings.card?.providerName || ""),
    providerCode: settings.card?.providerCode || "manual_card",
    gatewayMode: settings.card?.gatewayMode || "manual_review",
    supportedCountries: settings.card?.supportedCountries || [],
    instructions: settings.card?.instructions || "",
  },
  transfer: {
    enabled: Boolean(settings.transfer?.enabled),
    label: settings.transfer?.label || "????? ????",
    bankName: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.bankName || ""),
    accountName: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.accountName || ""),
    accountNumber: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.accountNumber || ""),
    iban: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.iban || ""),
    providerName: settings.transfer?.publishDetailsToStudents === false ? "" : (settings.transfer?.providerName || ""),
    providerCode: settings.transfer?.providerCode || "manual_transfer",
    gatewayMode: settings.transfer?.gatewayMode || "manual_review",
    supportedCountries: settings.transfer?.supportedCountries || [],
    instructions: settings.transfer?.instructions || "",
  },
  wallet: {
    enabled: Boolean(settings.wallet?.enabled),
    label: settings.wallet?.label || "????? ?????????",
    providerName: settings.wallet?.publishDetailsToStudents === false ? "" : (settings.wallet?.providerName || ""),
    providerCode: settings.wallet?.providerCode || "manual_wallet",
    gatewayMode: settings.wallet?.gatewayMode || "manual_review",
    supportedCountries: settings.wallet?.supportedCountries || [],
    phoneNumber: settings.wallet?.publishDetailsToStudents === false ? "" : (settings.wallet?.phoneNumber || ""),
    instructions: settings.wallet?.instructions || "",
  },
  notes: settings.notes || "",
});

const getPaymentWebhookSecret = (settings: any) =>
  String(process.env.PAYMENT_WEBHOOK_SECRET || settings.webhookSecret || "").trim();

const getOrCreateSettings = async () => {
  let settings = await PaymentSettingsModel.findOne({ key: "default" });
  if (!settings) {
    settings = await PaymentSettingsModel.create({ key: "default", ...defaultSettings });
  }
  return settings;
};

const isPaymentMethodEnabled = (settings: any, method: "card" | "transfer" | "wallet") =>
  Boolean(settings?.[method]?.enabled);

const hasManualPaymentEvidence = (request: {
  paymentMethod?: string;
  transferReference?: string;
  walletNumber?: string;
  receiptUrl?: string;
  notes?: string;
}, approvalEvidence = "") => {
  const hasReceipt = Boolean(String(request.receiptUrl || "").trim());
  const hasTransferReference = Boolean(String(request.transferReference || "").trim());
  const hasWalletNumber = Boolean(String(request.walletNumber || "").trim());
  const hasCardEvidence = String(request.notes || "").trim().length >= 4;
  const hasAdminEvidence = String(approvalEvidence || "").trim().length >= 6;

  if (request.paymentMethod === "transfer") return hasReceipt || hasTransferReference || hasAdminEvidence;
  if (request.paymentMethod === "wallet") return hasReceipt || hasWalletNumber || hasAdminEvidence;
  if (request.paymentMethod === "card") return hasReceipt || hasCardEvidence || hasAdminEvidence;
  return hasReceipt || hasTransferReference || hasWalletNumber || hasAdminEvidence;
};

const buildPaymentEvidenceSummary = (request: {
  paymentMethod?: string;
  transferReference?: string;
  walletNumber?: string;
  receiptUrl?: string;
  notes?: string;
}, approvalEvidence = "") => [
  request.paymentMethod ? `method:${request.paymentMethod}` : "",
  request.transferReference ? `transfer:${request.transferReference}` : "",
  request.walletNumber ? `wallet:${request.walletNumber}` : "",
  request.receiptUrl ? `receipt:${request.receiptUrl}` : "",
  approvalEvidence ? `admin:${approvalEvidence}` : "",
].filter(Boolean).join(" | ");

const verifyPaymentWebhookSignature = (secret: string, payload: unknown, signature?: string | string[]) => {
  const provided = String(Array.isArray(signature) ? signature[0] : signature || "").replace(/^sha256=/, "").trim();
  if (!secret || !provided) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
};

const userAlreadyOwnsPurchase = (
  user: any,
  target: {
    itemType: "course" | "package" | "skill" | "test";
    itemId: string;
    packageId: string;
    includedCourseIds: string[];
  },
) => {
  const purchasedCourses = new Set<string>([
    ...((user.subscription?.purchasedCourses || []).map(String)),
    ...((user.enrolledCourses || []).map(String)),
  ]);
  const purchasedPackages = new Set<string>((user.subscription?.purchasedPackages || []).map(String));
  const targetPackageId = target.packageId || (target.itemType === "package" ? target.itemId : "");

  if (target.itemType === "course" && purchasedCourses.has(target.itemId)) {
    return true;
  }

  if (targetPackageId && purchasedPackages.has(targetPackageId)) {
    return true;
  }

  if (target.includedCourseIds?.length && target.includedCourseIds.every((courseId) => purchasedCourses.has(String(courseId)))) {
    return true;
  }

  return false;
};

const buildPaymentRequestLookup = (id: string) => ({
  $or: [
    { id },
    ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
  ],
});

const normalizeDiscountCode = (code?: string) => String(code || "").trim().toUpperCase().replace(/\s+/g, "");

const isDiscountCodeActive = (discountCode: any, now = Date.now()) => {
  if (!discountCode || discountCode.status !== "active") return false;
  if (discountCode.startsAt && discountCode.startsAt > now) return false;
  if (discountCode.expiresAt && discountCode.expiresAt < now) return false;
  if (discountCode.maxRedemptions > 0 && discountCode.currentRedemptions >= discountCode.maxRedemptions) return false;
  return true;
};

const discountAppliesToPayload = (
  discountCode: any,
  originalAmount: number,
  payload: {
    itemType: "course" | "package" | "skill" | "test";
    itemId: string;
    packageId?: string;
    includedCourseIds?: string[];
  },
  purchasableItem: any,
) => {
  const packageId = payload.packageId || (payload.itemType === "package" ? payload.itemId : "");
  const pathId = purchasableItem?.pathId || purchasableItem?.category || "";
  const subjectId = purchasableItem?.subjectId || purchasableItem?.subject || "";
  const contentTypes = purchasableItem?.packageContentTypes?.length ? purchasableItem.packageContentTypes : [];

  if (discountCode.minAmount > 0 && originalAmount < discountCode.minAmount) return false;
  if (discountCode.packageIds?.length && !discountCode.packageIds.includes(packageId || payload.itemId)) return false;
  if (discountCode.pathIds?.length && (!pathId || !discountCode.pathIds.includes(pathId))) return false;
  if (discountCode.subjectIds?.length && (!subjectId || !discountCode.subjectIds.includes(subjectId))) return false;
  if (discountCode.contentTypes?.length && contentTypes.length && !contentTypes.some((type: string) => discountCode.contentTypes.includes(type))) return false;
  return true;
};

const getPaymentTargetItemId = (
  payload: Pick<z.infer<typeof paymentRequestCreateSchema>, "itemType" | "itemId" | "packageId">,
) => payload.packageId || payload.itemId;

const buildTrustedPaymentTarget = async (payload: z.infer<typeof paymentRequestCreateSchema>) => {
  const targetItemId = getPaymentTargetItemId(payload);
  const primaryTarget = await CourseModel.findById(targetItemId).lean();

  if (!primaryTarget) {
    return {
      ok: false as const,
      error: "?????? ??????? ??? ????? ?? ?? ????",
    };
  }

  const targetKindError = validatePaymentTargetKind(payload, primaryTarget);
  if (targetKindError) {
    return {
      ok: false as const,
      error: targetKindError,
    };
  }

  let packageItem = primaryTarget;
  if (payload.packageId && payload.itemType !== "package") {
    const foundPackage = await CourseModel.findById(payload.packageId).lean();
    if (!foundPackage || foundPackage.isPackage !== true) {
      return {
        ok: false as const,
        error: "?????? ???????? ???? ????? ??? ?????.",
      };
    }
    packageItem = foundPackage;
  }

  const currency = String((primaryTarget.currency || packageItem.currency || "SAR")).trim() || "SAR";
  const rawAmount = primaryTarget.originalPrice ?? primaryTarget.price ?? 0;
  const resolvedAmount = Number.isFinite(rawAmount) ? Math.max(0, Number(rawAmount)) : 0;
  const resolvedIncludedCourseIds = Array.isArray(packageItem?.includedCourses)
    ? packageItem.includedCourses.filter(Boolean).map((id: any) => String(id))
    : [];
  const resolvedPackageId = payload.packageId || (payload.itemType === "package" ? payload.itemId : "");

  return {
    ok: true as const,
    target: primaryTarget,
    packageItem,
    packageId: resolvedPackageId,
    itemName: String(primaryTarget.title || ""),
    originalAmount: resolvedAmount,
    includedCourseIds: resolvedIncludedCourseIds,
    currency,
  };
};

const validatePaymentTargetKind = (
  payload: Pick<z.infer<typeof paymentRequestCreateSchema>, "itemType" | "itemId" | "packageId">,
  purchasableItem: any,
) => {
  if (payload.itemType === "package") {
    if (!purchasableItem || purchasableItem.isPackage !== true) {
      return PAYMENT_ERRORS.courseAsPackage;
    }
  }

  if (payload.itemType === "course") {
    if (!purchasableItem || purchasableItem.isPackage === true) {
      return PAYMENT_ERRORS.packageAsCourse;
    }
  }

  if ((payload.itemType === "skill" || payload.itemType === "test") && payload.packageId) {
    if (!purchasableItem || purchasableItem.isPackage !== true) {
      return PAYMENT_ERRORS.packageRequiredForSkillOrTest;
    }
  }

  return "";
};

const calculateDiscountAmount = (discountCode: any, amount: number) => {
  if (discountCode.type === "fixed") {
    return Math.min(amount, Math.max(0, discountCode.value));
  }
  return Math.min(amount, Math.round((amount * Math.min(Math.max(discountCode.value, 0), 100)) / 100));
};

const reserveDiscountRedemptionForRequest = async (requestDoc: any) => {
  if (!requestDoc.discountCode || !requestDoc.discountCodeId) return true;

  const redemption = await DiscountCodeModel.findOneAndUpdate(
    {
      _id: requestDoc.discountCodeId,
      status: "active",
      $or: [{ maxRedemptions: 0 }, { $expr: { $lt: ["$currentRedemptions", "$maxRedemptions"] } }],
    },
    { $inc: { currentRedemptions: 1 } },
    { new: true },
  );

  return Boolean(redemption);
};

const completeApprovedPaymentRequest = async (
  requestDoc: any,
  review: {
    reviewedBy: string;
    reviewerNotes?: string;
    approvalEvidence: string;
    gatewayProvider?: string;
    gatewayTransactionId?: string;
    gatewayEventId?: string;
    gatewayPaidAt?: number;
  },
) => {
  const updatedRequest = await PaymentRequestModel.findOneAndUpdate(
    { _id: requestDoc._id, status: "pending" },
    {
      $set: {
        status: "approved",
        reviewerNotes: review.reviewerNotes || "",
        approvalEvidence: review.approvalEvidence,
        reviewedBy: review.reviewedBy,
        reviewedAt: Date.now(),
        gatewayProvider: review.gatewayProvider || requestDoc.gatewayProvider || "",
        gatewayTransactionId: review.gatewayTransactionId || requestDoc.gatewayTransactionId || "",
        gatewayEventId: review.gatewayEventId || requestDoc.gatewayEventId || "",
        gatewayPaidAt: review.gatewayPaidAt || requestDoc.gatewayPaidAt || null,
      },
    },
    { new: true },
  );

  if (!updatedRequest) {
    return {
      request: null,
      duplicate: true,
    };
  }

  return {
    request: updatedRequest,
    duplicate: false,
  };
};

const grantApprovedPaymentAccess = async (updatedRequest: any, review: {
  reviewedBy: string;
  gatewayEventId?: string;
  gatewayProvider?: string;
  gatewayTransactionId?: string;
}) => {
  const packageId = updatedRequest.packageId || (updatedRequest.itemType === "package" ? updatedRequest.itemId : undefined);
  const courseIds = [
    ...(updatedRequest.itemType === "course" ? [updatedRequest.itemId] : []),
    ...(Array.isArray(updatedRequest.includedCourseIds) ? updatedRequest.includedCourseIds.map(String) : []),
  ];
  const grantResult = await grantAccessToUser({
    userId: updatedRequest.userId,
    sourceType: review.gatewayEventId ? "payment_webhook" : "payment_request",
    sourceId: review.gatewayEventId
      ? `${String(updatedRequest.id || updatedRequest._id)}:${review.gatewayEventId}`
      : String(updatedRequest.id || updatedRequest._id),
    packageId,
    courseIds,
    grantedBy: review.reviewedBy,
    idempotencyKey: review.gatewayEventId
      ? `payment_webhook:${String(updatedRequest.id || updatedRequest._id)}:${review.gatewayEventId}`
      : `payment_request:${String(updatedRequest.id || updatedRequest._id)}`,
    metadata: {
      paymentRequestId: String(updatedRequest.id || updatedRequest._id),
      itemType: updatedRequest.itemType,
      itemId: updatedRequest.itemId,
      amount: updatedRequest.amount,
      currency: updatedRequest.currency,
      paymentProviderCode: updatedRequest.paymentProviderCode || "",
      paymentGatewayMode: updatedRequest.paymentGatewayMode || "",
      paymentCountry: updatedRequest.paymentCountry || "",
      gatewayProvider: review.gatewayProvider || "",
      gatewayTransactionId: review.gatewayTransactionId || "",
    },
  });

  return {
    user: grantResult.user,
    grant: grantResult.grant,
  };
};

export const paymentRouter = Router();

paymentRouter.get(
  "/settings",
  optionalAuth,
  asyncHandler(async (req, res) => {
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
    const settings = await getOrCreateSettings();
    Object.assign(settings, payload);
    await settings.save();
    await recordAdminAuditLog(req, {
      action: "payment.settings.update",
      resourceType: "payment-settings",
      resourceId: "default",
      metadata: { changedKeys: Object.keys(payload) },
    });
    return res.json(settings);
  }),
);

paymentRouter.get(
  "/settings/presets",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    return res.json({
      presets: paymentCountryPresets,
      countries: [
        { code: "SA", label: "????????" },
        { code: "EG", label: "???" },
      ],
    });
  }),
);

paymentRouter.post(
  "/settings/apply-country-preset",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = paymentCountryPresetSchema.parse(req.body);
    const settings = await getOrCreateSettings();
    const preset = paymentCountryPresets[payload.country];

    settings.currency = preset.currency;
    settings.card = {
      ...settings.card,
      ...preset.card,
    } as any;
    settings.transfer = {
      ...settings.transfer,
      ...preset.transfer,
    } as any;
    settings.wallet = {
      ...settings.wallet,
      ...preset.wallet,
    } as any;

    await settings.save();
    await recordAdminAuditLog(req, {
      action: "payment.settings.apply-country-preset",
      resourceType: "payment-settings",
      resourceId: "default",
      metadata: { country: payload.country },
    });
    return res.json(settings);
  }),
);

paymentRouter.get(
  "/requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = paymentRequestListQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = req.authUser?.role === "admin" ? {} : { userId: req.authUser?.id };
    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }
    if (query.paymentCountry && query.paymentCountry !== "all") {
      filter.paymentCountry = query.paymentCountry;
    }
    if (query.paymentMethod && query.paymentMethod !== "all") {
      filter.paymentMethod = query.paymentMethod;
    }
    const search = String(query.search || "").trim();
    if (search) {
      filter.$or = [
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
        { itemName: { $regex: search, $options: "i" } },
        { id: { $regex: search, $options: "i" } },
        { paymentProviderCode: { $regex: search, $options: "i" } },
      ];
    }
    const pagination = resolvePagination(req.query, { limit: 50 });
    const [requests, total] = await Promise.all([
      PaymentRequestModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      PaymentRequestModel.countDocuments(filter),
    ]);
    return res.json({
      requests,
      pagination: buildPaginatedResponse(requests, pagination, total),
    });
  }),
);

paymentRouter.get(
  "/requests/summary",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    const [all, pending, approved, rejected, cancelled] = await Promise.all([
      PaymentRequestModel.countDocuments({}),
      PaymentRequestModel.countDocuments({ status: "pending" }),
      PaymentRequestModel.countDocuments({ status: "approved" }),
      PaymentRequestModel.countDocuments({ status: "rejected" }),
      PaymentRequestModel.countDocuments({ status: "cancelled" }),
    ]);
    return res.json({
      totals: { all, pending, approved, rejected, cancelled },
    });
  }),
);

paymentRouter.get(
  "/discount-codes",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const query = discountCodeListQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== "all") {
      filter.status = query.status;
    }
    const search = String(query.search || "").trim().toUpperCase();
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: "i" } },
        { label: { $regex: search, $options: "i" } },
      ];
    }
    const pagination = resolvePagination(req.query, { limit: 50 });
    const [codes, total] = await Promise.all([
      DiscountCodeModel.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      DiscountCodeModel.countDocuments(filter),
    ]);
    return res.json({
      codes,
      pagination: buildPaginatedResponse(codes, pagination, total),
    });
  }),
);

paymentRouter.post(
  "/discount-codes/preview",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = discountCodePreviewSchema.parse(req.body);
    const normalizedDiscountCode = normalizeDiscountCode(payload.discountCode);
    const trustedRequestPayload: any = {
      itemType: payload.itemType || "course",
      itemId: payload.itemId,
      packageId: payload.packageId,
      includedCourseIds: [],
      paymentMethod: "transfer",
      paymentProviderCode: "",
      paymentGatewayMode: "manual_review",
      paymentCountry: "",
      notes: "",
      transferReference: "",
      walletNumber: "",
      receiptUrl: "",
      discountCode: "",
    };
    const resolvedTarget = await buildTrustedPaymentTarget(trustedRequestPayload);
    const originalAmount = resolvedTarget.ok ? resolvedTarget.originalAmount : 0;

    if (!normalizedDiscountCode) {
      return res.json({ valid: false, originalAmount, discountAmount: 0, finalAmount: originalAmount });
    }

    if (!resolvedTarget.ok) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        valid: false,
        message: resolvedTarget.error,
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
      });
    }

    const discountCode = await DiscountCodeModel.findOne({ code: normalizedDiscountCode });
    if (!discountCode || !isDiscountCodeActive(discountCode)
      || !discountAppliesToPayload(
        discountCode,
        originalAmount,
        {
          itemType: payload.itemType || "course",
          itemId: payload.itemId,
          packageId: payload.packageId,
          includedCourseIds: resolvedTarget.includedCourseIds,
        },
        resolvedTarget.target,
      )) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        valid: false,
        message: "??? ????? ??? ???? ???? ?????",
        originalAmount,
        discountAmount: 0,
        finalAmount: originalAmount,
      });
    }

    const discountAmount = calculateDiscountAmount(discountCode, originalAmount);
    return res.json({
      valid: true,
      code: normalizedDiscountCode,
      label: discountCode.label || normalizedDiscountCode,
      originalAmount,
      discountAmount,
      finalAmount: Math.max(0, originalAmount - discountAmount),
    });
  }),
);

paymentRouter.post(
  "/discount-codes",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = discountCodePayloadSchema.parse(req.body);
    const code = normalizeDiscountCode(payload.code);
    const created = await DiscountCodeModel.findOneAndUpdate(
      { code },
      {
        ...payload,
        code,
        label: payload.label || code,
        minAmount: payload.minAmount || 0,
        maxRedemptions: payload.maxRedemptions || 0,
        packageIds: payload.packageIds || [],
        pathIds: payload.pathIds || [],
        subjectIds: payload.subjectIds || [],
        contentTypes: payload.contentTypes || [],
        createdBy: req.authUser?.id || "",
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await recordAdminAuditLog(req, {
      action: "payment.discount-code.upsert",
      resourceType: "discount-code",
      resourceId: code,
      metadata: { status: created.status, type: created.type, value: created.value },
    });
    return res.status(StatusCodes.CREATED).json({ code: created });
  }),
);

paymentRouter.patch(
  "/discount-codes/:code",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = discountCodePayloadSchema.partial().parse(req.body);
    const code = normalizeDiscountCode(req.params.code);
    const updated = await DiscountCodeModel.findOneAndUpdate(
      { code },
      {
        ...payload,
        ...(payload.code ? { code: normalizeDiscountCode(payload.code) } : {}),
      },
      { new: true },
    );
    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Discount code not found" });
    }
    await recordAdminAuditLog(req, {
      action: "payment.discount-code.update",
      resourceType: "discount-code",
      resourceId: code,
      metadata: { changedKeys: Object.keys(payload) },
    });
    return res.json({ code: updated });
  }),
);

paymentRouter.post(
  "/requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = paymentRequestCreateSchema.parse(req.body);
    const settings = await getOrCreateSettings();
    const user = await UserModel.findById(req.authUser?.id);
    const selectedMethodSettings = ((settings as any)[payload.paymentMethod] || {}) as {
      providerCode?: string;
      gatewayMode?: "manual_review" | "payment_link" | "webhook";
      supportedCountries?: string[];
    };

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
    }

    if (!isPaymentMethodEnabled(settings, payload.paymentMethod)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "????? ????? ??? ????? ??????" });
    }

    if (
      payload.paymentCountry &&
      Array.isArray(selectedMethodSettings.supportedCountries) &&
      selectedMethodSettings.supportedCountries.length > 0 &&
      !selectedMethodSettings.supportedCountries.includes(payload.paymentCountry)
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: PAYMENT_ERRORS.paymentMethodUnavailableForCountry });
    }

    if (!hasManualPaymentEvidence(payload)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "???? ???? ??? ?? ??????? ?????? ??? ???? ?????? ????? ??????",
      });
    }

    const trustedTarget = await buildTrustedPaymentTarget(payload);
    if (!trustedTarget.ok) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: trustedTarget.error });
    }

    if (userAlreadyOwnsPurchase(user, {
      itemType: payload.itemType,
      itemId: payload.itemId,
      packageId: trustedTarget.packageId || "",
      includedCourseIds: trustedTarget.includedCourseIds || [],
    })) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "??? ??????? ???? ?????? ??? ?????",
      });
    }

    const pendingDuplicate = await PaymentRequestModel.findOne({
      userId: String(user._id),
      itemType: payload.itemType,
      itemId: payload.itemId,
      status: "pending",
    });

    if (pendingDuplicate) {
      return res.status(StatusCodes.CONFLICT).json({
        message: "???? ??? ??? ??? ???????? ???? ??????? ??????",
        request: pendingDuplicate,
      });
    }

    const originalAmount = trustedTarget.originalAmount;
    let finalAmount = originalAmount;
    let discountAmount = 0;
    let discountCodeId = "";
    const normalizedDiscountCode = normalizeDiscountCode(payload.discountCode);

    if (normalizedDiscountCode) {
      const discountCode = await DiscountCodeModel.findOne({ code: normalizedDiscountCode });
      if (!discountCode || !isDiscountCodeActive(discountCode) || !discountAppliesToPayload(
        discountCode,
        originalAmount,
        {
          itemType: payload.itemType,
          itemId: payload.itemId,
          packageId: trustedTarget.packageId,
          includedCourseIds: trustedTarget.includedCourseIds || [],
        },
        trustedTarget.target,
      )) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "??? ????? ??? ???? ???? ?????" });
      }
      discountAmount = calculateDiscountAmount(discountCode, originalAmount);
      finalAmount = Math.max(0, originalAmount - discountAmount);
      discountCodeId = String(discountCode._id);
    }

        const created = await PaymentRequestModel.create({
      id: `payreq_${Date.now()}`,
      userId: String(user._id),
      userName: user.name,
      userEmail: user.email,
      itemType: payload.itemType,
      itemId: payload.itemId,
      itemName: trustedTarget.itemName,
      packageId: trustedTarget.packageId || "",
      includedCourseIds: trustedTarget.includedCourseIds || [],
      currency: trustedTarget.currency,
      paymentMethod: payload.paymentMethod,
      transferReference: payload.transferReference || "",
      walletNumber: payload.walletNumber || "",
      receiptUrl: payload.receiptUrl || "",
      paymentProviderCode: payload.paymentProviderCode || selectedMethodSettings.providerCode || "",
      paymentGatewayMode: payload.paymentGatewayMode || selectedMethodSettings.gatewayMode || "manual_review",
      paymentCountry: payload.paymentCountry || selectedMethodSettings.supportedCountries?.[0] || "",
      notes: payload.notes || "",
      originalAmount,
      discountAmount,
      discountCodeId,
      amount: finalAmount,
      discountCode: normalizedDiscountCode,
      status: "pending",
    });

    return res.status(StatusCodes.CREATED).json({ request: created });
  }),
);

paymentRouter.post(
  "/webhooks/payment",
  asyncHandler(async (req, res) => {
    const payload = paymentWebhookSchema.parse(req.body);
    const settings = await getOrCreateSettings();
    const webhookSecret = getPaymentWebhookSecret(settings);

    if (!settings.webhookEnabled && !process.env.PAYMENT_WEBHOOK_SECRET) {
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ message: "Payment webhook is disabled" });
    }

    if (!verifyPaymentWebhookSignature(webhookSecret, req.body, req.headers["x-payment-signature"])) {
      await recordAdminAuditLog(req, {
        action: "payment.webhook.rejected",
        resourceType: "payment-request",
        resourceId: payload.paymentRequestId,
        status: "blocked",
        metadata: { provider: payload.provider, eventId: payload.eventId, reason: "invalid-signature" },
      });
      return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Invalid payment webhook signature" });
    }

    const requestDoc = await PaymentRequestModel.findOne(buildPaymentRequestLookup(payload.paymentRequestId));
    if (!requestDoc) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Payment request not found" });
    }

    if (requestDoc.gatewayEventId === payload.eventId || requestDoc.status === "approved") {
      return res.json({ ok: true, duplicate: true, request: requestDoc });
    }

    const duplicateGatewayEvent = await PaymentRequestModel.findOne({
      gatewayEventId: payload.eventId,
      _id: { $ne: requestDoc._id },
    });

    if (duplicateGatewayEvent) {
      return res.status(StatusCodes.CONFLICT).json({ message: "Payment gateway event was already used" });
    }

    if (requestDoc.status !== "pending") {
      return res.status(StatusCodes.CONFLICT).json({ message: "Payment request is not pending" });
    }

    if (payload.status !== "paid") {
      const rejectedRequest = await PaymentRequestModel.findOneAndUpdate(
        { _id: requestDoc._id, status: "pending" },
        {
          $set: {
            status: payload.status === "cancelled" ? "cancelled" : "rejected",
            reviewerNotes: `????? ?????: ${payload.status}`,
            reviewedBy: `webhook:${payload.provider}`,
            reviewedAt: Date.now(),
            gatewayProvider: payload.provider,
            gatewayTransactionId: payload.transactionId || "",
            gatewayEventId: payload.eventId,
          },
        },
        { new: true },
      );
      return res.json({ ok: true, request: rejectedRequest || requestDoc });
    }

    if (payload.currency && payload.currency !== requestDoc.currency) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Payment currency mismatch" });
    }

    if (typeof payload.paidAmount === "number" && payload.paidAmount < requestDoc.amount) {
      return res.status(StatusCodes.BAD_REQUEST).json({ message: "Paid amount is lower than request amount" });
    }

    const approved = await completeApprovedPaymentRequest(requestDoc, {
      reviewedBy: `webhook:${payload.provider}`,
      reviewerNotes: "?? ???????? ????? ?? ????? ?????",
      approvalEvidence: `webhook:${payload.provider}:${payload.transactionId || payload.eventId}`,
      gatewayProvider: payload.provider,
      gatewayTransactionId: payload.transactionId || "",
      gatewayEventId: payload.eventId,
      gatewayPaidAt: payload.occurredAt || Date.now(),
    });

    if (approved.duplicate || !approved.request) {
      return res.status(StatusCodes.CONFLICT).json({ message: "Payment request is not pending" });
    }

    const discountReserved = await reserveDiscountRedemptionForRequest(approved.request);
    if (!discountReserved) {
      await PaymentRequestModel.findByIdAndUpdate(approved.request._id, {
        $set: {
          status: "pending",
          reviewerNotes: PAYMENT_ERRORS.discountNoLongerAvailableForApproval,
          reviewedBy: "",
          reviewedAt: null,
        },
      });
      return res.status(StatusCodes.CONFLICT).json({ message: "??? ????? ?? ??? ?????? ????????" });
    }

    const access = await grantApprovedPaymentAccess(approved.request, {
      reviewedBy: `webhook:${payload.provider}`,
      gatewayProvider: payload.provider,
      gatewayTransactionId: payload.transactionId || "",
      gatewayEventId: payload.eventId,
    });

    await recordAdminAuditLog(req, {
      action: "payment.webhook.approved",
      resourceType: "payment-request",
      resourceId: String(approved.request.id || approved.request._id),
      metadata: {
        provider: payload.provider,
        eventId: payload.eventId,
        transactionId: payload.transactionId || "",
        amount: payload.paidAmount ?? approved.request.amount,
        userId: approved.request.userId,
      },
    });

    return res.json({ ok: true, request: approved.request, user: access.user, accessGrant: access.grant });
  }),
);

paymentRouter.patch(
  "/requests/:id/review",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = paymentRequestReviewSchema.parse(req.body);
    const requestDoc = await PaymentRequestModel.findOne(buildPaymentRequestLookup(req.params.id));

    if (!requestDoc) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Payment request not found" });
    }

    if (requestDoc.status === "approved" && payload.status === "approved") {
      return res.status(StatusCodes.CONFLICT).json({
        message: "??? ????? ????? ??????",
        request: requestDoc,
      });
    }

    if (payload.status === "approved") {
      const purchaseUser = await UserModel.findById(requestDoc.userId).select("_id");
      if (!purchaseUser) {
        return res.status(StatusCodes.NOT_FOUND).json({ message: PAYMENT_ERRORS.missingPurchaseUserForApproval });
      }

      if (!hasManualPaymentEvidence(requestDoc, payload.approvalEvidence)) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: "?? ???? ?????? ??? ??? ???? ???? ?? ????? ?? ???? ?????? ????",
        });
      }

    }

    let approved: Awaited<ReturnType<typeof completeApprovedPaymentRequest>> | null = null;
    if (payload.status === "approved") {
      approved = await completeApprovedPaymentRequest(requestDoc, {
        reviewedBy: req.authUser?.id || "",
        reviewerNotes: payload.reviewerNotes || "",
        approvalEvidence: buildPaymentEvidenceSummary(requestDoc, payload.approvalEvidence),
      });

      if (approved.duplicate || !approved.request) {
        return res.status(StatusCodes.CONFLICT).json({
          message: "??? ????? ?? ??? ??? ????????",
          request: await PaymentRequestModel.findById(requestDoc._id),
        });
      }

      const discountReserved = await reserveDiscountRedemptionForRequest(approved.request);
      if (!discountReserved) {
        await PaymentRequestModel.findByIdAndUpdate(approved.request._id, {
          $set: {
            status: "pending",
            reviewerNotes: PAYMENT_ERRORS.discountNoLongerAvailableForApproval,
            approvalEvidence: "",
            reviewedBy: "",
            reviewedAt: null,
          },
        });
        return res.status(StatusCodes.CONFLICT).json({ message: PAYMENT_ERRORS.discountApprovalFailedDuringReview });
      }

      const access = await grantApprovedPaymentAccess(approved.request, {
        reviewedBy: req.authUser?.id || "",
      });
      (approved as any).user = access.user;
      (approved as any).grant = access.grant;
    } else {
      await PaymentRequestModel.findOneAndUpdate(
        { _id: requestDoc._id, status: { $ne: "approved" } },
        {
          $set: {
            status: payload.status,
            reviewerNotes: payload.reviewerNotes || "",
            approvalEvidence: "",
            reviewedBy: req.authUser?.id || "",
            reviewedAt: Date.now(),
          },
        },
        { new: true },
      );
    }

    await recordAdminAuditLog(req, {
      action: "payment.request.review",
      resourceType: "payment-request",
      resourceId: String(requestDoc.id || requestDoc._id),
      metadata: {
        status: payload.status,
        itemType: requestDoc.itemType,
        itemId: requestDoc.itemId,
        userId: requestDoc.userId,
        discountCode: requestDoc.discountCode || "",
        discountAmount: requestDoc.discountAmount || 0,
        approvalEvidence: requestDoc.approvalEvidence || "",
      },
    });

    return res.json({
      request: approved?.request || (await PaymentRequestModel.findById(requestDoc._id)),
      user: (approved as any)?.user || null,
      accessGrant: (approved as any)?.grant || null,
    });
  }),
);



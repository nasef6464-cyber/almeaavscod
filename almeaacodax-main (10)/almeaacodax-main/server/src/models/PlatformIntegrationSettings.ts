import mongoose, { Schema } from "mongoose";

const providerSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    mode: { type: String, default: "oauth" },
    appId: { type: String, default: "" },
    appSecret: { type: String, default: "" },
    clientId: { type: String, default: "" },
    clientSecret: { type: String, default: "" },
    apiKey: { type: String, default: "" },
    accessToken: { type: String, default: "" },
    callbackUrl: { type: String, default: "" },
    fromEmail: { type: String, default: "" },
    senderName: { type: String, default: "" },
    botUsername: { type: String, default: "" },
    botToken: { type: String, default: "" },
    chatId: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    phoneNumberId: { type: String, default: "" },
    businessAccountId: { type: String, default: "" },
    verifyToken: { type: String, default: "" },
    webhookUrl: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const registrationFieldSchema = new Schema(
  {
    id: { type: String, required: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["text", "email", "phone", "select", "textarea"], default: "text" },
    required: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    options: { type: [String], default: [] },
    placeholder: { type: String, default: "" },
    helpText: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { _id: false },
);

const platformIntegrationSettingsSchema = new Schema<any>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    auth: {
      allowSelfRegistration: { type: Boolean, default: true },
      allowEmailPassword: { type: Boolean, default: true },
      requireEmailVerification: { type: Boolean, default: false },
      requireAdminApproval: { type: Boolean, default: false },
      defaultRole: { type: String, enum: ["student", "parent"], default: "student" },
      registrationTitle: { type: String, default: "" },
      registrationSubtitle: { type: String, default: "" },
      termsLink: { type: String, default: "" },
      privacyLink: { type: String, default: "" },
      maxAccountsPerDevice: { type: Number, default: 3 },
      allowedEmailDomains: { type: [String], default: [] },
    },
    providers: {
      google: { type: providerSchema, default: () => ({ enabled: false, mode: "oauth" }) },
      facebook: { type: providerSchema, default: () => ({ enabled: false, mode: "oauth" }) },
      whatsapp: { type: providerSchema, default: () => ({ enabled: false, mode: "otp" }) },
      telegram: { type: providerSchema, default: () => ({ enabled: false, mode: "bot" }) },
      email: { type: providerSchema, default: () => ({ enabled: false, mode: "smtp" }) },
      sentry: { type: providerSchema, default: () => ({ enabled: false, mode: "dsn" }) },
      redis: { type: providerSchema, default: () => ({ enabled: false, mode: "managed" }) },
      zoom: { type: providerSchema, default: () => ({ enabled: false, mode: "oauth" }) },
      googleMeet: { type: providerSchema, default: () => ({ enabled: false, mode: "oauth" }) },
      teams: { type: providerSchema, default: () => ({ enabled: false, mode: "oauth" }) },
      youtubeLive: { type: providerSchema, default: () => ({ enabled: false, mode: "api" }) },
    },
    seo: {
      enabled: { type: Boolean, default: true },
      siteName: { type: String, default: "منصة المئة" },
      defaultTitle: { type: String, default: "منصة المئة | قدرات وتحصيلي" },
      defaultDescription: { type: String, default: "منصة تعليمية ذكية للتدريب على القدرات والتحصيلي." },
      defaultKeywords: { type: [String], default: [] },
      canonicalBaseUrl: { type: String, default: "" },
      defaultOgImage: { type: String, default: "" },
      twitterHandle: { type: String, default: "" },
      googleSiteVerification: { type: String, default: "" },
      googleAnalyticsId: { type: String, default: "" },
      googleTagManagerId: { type: String, default: "" },
      robotsIndexingEnabled: { type: Boolean, default: true },
      noIndexPaths: { type: [String], default: ["/#/admin-dashboard", "/#/dashboard", "/#/login"] },
      organizationName: { type: String, default: "منصة المئة" },
      organizationLogoUrl: { type: String, default: "" },
      organizationUrl: { type: String, default: "" },
    },
    contactWidget: {
      enabled: { type: Boolean, default: true },
      channel: { type: String, enum: ["whatsapp", "telegram", "phone"], default: "whatsapp" },
      whatsappNumber: { type: String, default: "" },
      whatsappMessage: { type: String, default: "مرحبًا، أريد الاستفسار عن منصة المئة." },
      openInNewTab: { type: Boolean, default: true },
      showOnPublicPages: { type: Boolean, default: true },
      showOnDashboardPages: { type: Boolean, default: false },
    },
    externalPlatforms: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            enabled: { type: Boolean, default: false },
            platformType: { type: String, enum: ["lms", "marketplace", "crm", "custom"], default: "custom" },
            baseUrl: { type: String, default: "" },
            apiKey: { type: String, default: "" },
            apiSecret: { type: String, default: "" },
            webhookUrl: { type: String, default: "" },
            webhookSecret: { type: String, default: "" },
            syncStudents: { type: Boolean, default: false },
            syncCourses: { type: Boolean, default: false },
            syncOrders: { type: Boolean, default: false },
            syncScheduleCron: { type: String, default: "" },
            note: { type: String, default: "" },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    registrationFields: { type: [registrationFieldSchema], default: [] },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

platformIntegrationSettingsSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const safeRet = ret as Record<string, unknown>;
    delete safeRet.__v;
    return safeRet;
  },
});

export const PlatformIntegrationSettingsModel = mongoose.model(
  "PlatformIntegrationSettings",
  platformIntegrationSettingsSchema,
);

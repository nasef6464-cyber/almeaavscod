import mongoose, { Schema } from "mongoose";

const paymentMethodSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    label: { type: String, default: "" },
    accountName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    iban: { type: String, default: "" },
    bankName: { type: String, default: "" },
    instructions: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    providerName: { type: String, default: "" },
    providerCode: { type: String, default: "manual" },
    gatewayMode: { type: String, enum: ["manual_review", "payment_link", "webhook"], default: "manual_review" },
    supportedCountries: { type: [String], default: [] },
    publishDetailsToStudents: { type: Boolean, default: true },
  },
  { _id: false },
);

const paymentSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    currency: { type: String, default: "SAR" },
    manualReviewRequired: { type: Boolean, default: true },
    webhookEnabled: { type: Boolean, default: false },
    webhookSecret: { type: String, default: "" },
    card: { type: paymentMethodSettingsSchema, default: () => ({ enabled: false, label: "بطاقة بنكية", providerCode: "manual_card", gatewayMode: "manual_review", supportedCountries: ["SA", "EG"] }) },
    transfer: { type: paymentMethodSettingsSchema, default: () => ({ enabled: true, label: "تحويل بنكي", providerCode: "manual_transfer", gatewayMode: "manual_review", supportedCountries: ["SA", "EG"] }) },
    wallet: { type: paymentMethodSettingsSchema, default: () => ({ enabled: true, label: "محفظة إلكترونية", providerCode: "manual_wallet", gatewayMode: "manual_review", supportedCountries: ["SA", "EG"] }) },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

paymentSettingsSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const safeRet = ret as Record<string, unknown>;
    delete safeRet.__v;
    return safeRet;
  },
});

export const PaymentSettingsModel = mongoose.model("PaymentSettings", paymentSettingsSchema);

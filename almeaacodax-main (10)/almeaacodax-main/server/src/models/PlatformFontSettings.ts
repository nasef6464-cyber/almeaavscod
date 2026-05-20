import mongoose, { Schema } from "mongoose";

const platformFontFamilyValues = [
  "tajawal",
  "cairo",
  "almarai",
  "readex-pro",
  "ibm-plex-sans-arabic",
  "noto-naskh-arabic",
  "noto-kufi-arabic",
  "system",
  "custom",
];

const platformFontUploadSchema = new Schema(
  {
    name: { type: String, default: "" },
    dataUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
  },
  { _id: false },
);

const platformFontSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    bodyFont: {
      type: String,
      enum: platformFontFamilyValues,
      default: "tajawal",
    },
    headingFont: {
      type: String,
      enum: platformFontFamilyValues,
      default: "tajawal",
    },
    navigationFont: {
      type: String,
      enum: platformFontFamilyValues,
      default: "tajawal",
    },
    buttonFont: {
      type: String,
      enum: platformFontFamilyValues,
      default: "tajawal",
    },
    bodySize: { type: String, default: "" },
    headingSize: { type: String, default: "" },
    navigationSize: { type: String, default: "" },
    buttonSize: { type: String, default: "" },
    bodyWeight: { type: String, default: "" },
    headingWeight: { type: String, default: "" },
    navigationWeight: { type: String, default: "" },
    buttonWeight: { type: String, default: "" },
    bodyColor: { type: String, default: "" },
    headingColor: { type: String, default: "" },
    navigationColor: { type: String, default: "" },
    buttonColor: { type: String, default: "" },
    bodyCustomFont: { type: platformFontUploadSchema, default: () => ({}) },
    headingCustomFont: { type: platformFontUploadSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  },
);

platformFontSettingsSchema.set("toJSON", {
  transform: (_doc, ret) => {
    const safeRet = ret as Record<string, unknown>;
    delete safeRet.__v;
    return safeRet;
  },
});

export const PlatformFontSettingsModel = mongoose.model("PlatformFontSettings", platformFontSettingsSchema);

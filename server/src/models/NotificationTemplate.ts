import mongoose, { Schema } from "mongoose";

const notificationTemplateSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    key: { type: String, unique: true },
    name: { type: String, required: true },
    title: { type: String, default: "" },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    channels: { type: [String], default: ["in_app"] },
    subjectTemplate: { type: String, default: "" },
    bodyTemplate: { type: String, required: true },
    variables: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

notificationTemplateSchema.index({ key: 1 }, { unique: true, sparse: true });
notificationTemplateSchema.index({ code: 1 }, { unique: true });
notificationTemplateSchema.index({ isActive: 1 });

export const NotificationTemplateModel = mongoose.model("NotificationTemplate", notificationTemplateSchema);

import mongoose, { Schema } from "mongoose";

const notificationTemplateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["in_app", "email", "whatsapp"], default: "in_app", index: true },
    subject: { type: String, default: "" },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    variables: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

notificationTemplateSchema.index({ isActive: 1, channel: 1, updatedAt: -1 });

export const NotificationTemplateModel = mongoose.model("NotificationTemplate", notificationTemplateSchema);

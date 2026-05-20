import mongoose, { Schema } from "mongoose";

const notificationDeliverySchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    campaignId: { type: String },
    templateKey: { type: String },
    userId: { type: String, required: true },
    recipientUserId: { type: String },
    templateId: { type: String },
    channel: { type: String, enum: ["in_app", "email", "whatsapp", "sms"], default: "in_app" },
    status: { type: String, enum: ["pending", "sent", "delivered", "failed", "retrying"], default: "pending" },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    subject: { type: String, default: "" },
    recipientEmail: { type: String, default: "" },
    recipientPhone: { type: String, default: "" },
    recipientRole: { type: String, default: "" },
    provider: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    failureReason: { type: String, default: "" },
    retryCount: { type: Number, default: 0 },
    nextAttemptAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    error: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true },
);

notificationDeliverySchema.index({ id: 1 }, { unique: true });
notificationDeliverySchema.index({ campaignId: 1 });
notificationDeliverySchema.index({ status: 1, channel: 1 });
notificationDeliverySchema.index({ recipientUserId: 1, status: 1 });
notificationDeliverySchema.index({ nextAttemptAt: 1 });

export const NotificationDeliveryModel = mongoose.model("NotificationDelivery", notificationDeliverySchema);

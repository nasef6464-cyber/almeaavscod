import mongoose, { Schema } from "mongoose";

const notificationDeliverySchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    templateKey: { type: String, default: "", index: true },
    channel: { type: String, enum: ["in_app", "email", "whatsapp"], required: true, index: true },
    status: { type: String, enum: ["pending", "sent", "failed", "retrying"], default: "pending", index: true },
    title: { type: String, required: true, trim: true },
    subject: { type: String, default: "" },
    body: { type: String, required: true },
    recipientUserId: { type: String, required: true, index: true },
    recipientEmail: { type: String, default: "" },
    recipientPhone: { type: String, default: "" },
    recipientRole: { type: String, default: "", index: true },
    campaignId: { type: String, default: "", index: true },
    provider: { type: String, default: "" },
    providerMessageId: { type: String, default: "" },
    failureReason: { type: String, default: "" },
    retryCount: { type: Number, default: 0 },
    nextAttemptAt: { type: Number, default: null },
    sentAt: { type: Number, default: null },
    readAt: { type: Number, default: null },
    createdBy: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

notificationDeliverySchema.index({ recipientUserId: 1, channel: 1, createdAt: -1 });
notificationDeliverySchema.index({ status: 1, channel: 1, nextAttemptAt: 1, createdAt: 1 });
notificationDeliverySchema.index({ campaignId: 1, status: 1, createdAt: -1 });
notificationDeliverySchema.index({ createdBy: 1, createdAt: -1 });

export const NotificationDeliveryModel = mongoose.model("NotificationDelivery", notificationDeliverySchema);

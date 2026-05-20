import mongoose, { Schema } from "mongoose";

const announcementAdSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    imageAlt: { type: String, default: "" },
    imageFit: { type: String, enum: ["cover", "contain", "fill"], default: "cover" },
    linkUrl: { type: String, default: "" },
    linkLabel: { type: String, default: "" },
    audience: { type: String, enum: ["all", "students", "teachers", "admins"], default: "all" },
    displayMode: { type: String, enum: ["overlay", "banner"], default: "overlay" },
    frequency: { type: String, enum: ["once", "daily", "always"], default: "once" },
    startsAt: { type: Number },
    expiresAt: { type: Number },
    active: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const AnnouncementAdModel = mongoose.model("AnnouncementAd", announcementAdSchema);

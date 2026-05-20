import mongoose, { Schema } from "mongoose";

const announcementAdSchema = new Schema(
  {
    id: { type: String, index: true, sparse: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    ctaLabel: { type: String, default: "" },
    ctaUrl: { type: String, default: "" },
    audience: { type: String, enum: ["all", "guest", "student", "parent", "staff"], default: "all" },
    displayMode: { type: String, enum: ["modal", "top-banner"], default: "modal" },
    frequency: { type: String, enum: ["always", "session", "once"], default: "session" },
    imageFit: { type: String, enum: ["cover", "contain"], default: "cover" },
    delaySeconds: { type: Number, default: 0, min: 0, max: 30 },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    startsAt: { type: Number, default: null },
    endsAt: { type: Number, default: null },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  {
    timestamps: true,
  },
);

announcementAdSchema.pre("findOneAndUpdate", function updateTimestamp(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

announcementAdSchema.index({ isActive: 1, priority: 1, createdAt: -1 });
announcementAdSchema.index({ audience: 1, isActive: 1, priority: 1 });
announcementAdSchema.index({ startsAt: 1, endsAt: 1, isActive: 1 });

export const AnnouncementAdModel = mongoose.model("AnnouncementAd", announcementAdSchema);

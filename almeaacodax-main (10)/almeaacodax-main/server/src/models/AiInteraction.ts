import mongoose, { Schema } from "mongoose";

const aiInteractionSchema = new Schema(
  {
    audience: {
      type: String,
      enum: ["student", "admin", "teacher", "supervisor", "parent", "guest", "system"],
      default: "guest",
      index: true,
    },
    endpoint: { type: String, default: "", index: true },
    provider: {
      type: String,
      enum: ["gemini", "openrouter", "deepseek", "qwen", "openai", "ollama", "lmstudio", "none"],
      default: "none",
      index: true,
    },
    model: { type: String, default: "" },
    status: {
      type: String,
      enum: ["success", "fallback", "error"],
      default: "success",
      index: true,
    },
    usedFallback: { type: Boolean, default: false, index: true },
    personalized: { type: Boolean, default: false, index: true },
    latencyMs: { type: Number, default: 0 },
    messagePreview: { type: String, default: "" },
    responsePreview: { type: String, default: "" },
    responseLength: { type: Number, default: 0 },
    error: { type: String, default: "" },
    userId: { type: String, default: "", index: true },
    userEmail: { type: String, default: "" },
    role: { type: String, default: "", index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

aiInteractionSchema.index({ createdAt: -1 });
aiInteractionSchema.index({ endpoint: 1, audience: 1, createdAt: -1 });
aiInteractionSchema.index({ status: 1, createdAt: -1 });
aiInteractionSchema.index({ usedFallback: 1, createdAt: -1 });
aiInteractionSchema.index({ personalized: 1, createdAt: -1 });
aiInteractionSchema.index({ userId: 1, createdAt: -1 });

export const AiInteractionModel = mongoose.model("AiInteraction", aiInteractionSchema);

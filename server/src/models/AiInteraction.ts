import mongoose, { Schema } from "mongoose";

const aiInteractionSchema = new Schema(
  {
    userId: { type: String },
    type: { type: String, required: true },
    prompt: { type: String },
    response: { type: String },
    tokensUsed: { type: Number },
    provider: { type: String },
    model: { type: String },
    latencyMs: { type: Number },
  },
  { timestamps: true },
);

export const AiInteractionModel = mongoose.model("AiInteraction", aiInteractionSchema);

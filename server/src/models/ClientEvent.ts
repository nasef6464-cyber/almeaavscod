import mongoose, { Schema } from "mongoose";

const clientEventSchema = new Schema(
  {
    userId: { type: String },
    type: { type: String, required: true },
    message: { type: String },
    metadata: { type: Schema.Types.Mixed },
    url: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

export const ClientEventModel = mongoose.model("ClientEvent", clientEventSchema);

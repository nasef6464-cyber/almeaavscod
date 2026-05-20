import mongoose, { Schema } from "mongoose";

const activitySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["course_view", "lesson_complete", "quiz_complete", "skill_practice", "session_booked"],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    link: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

export const ActivityModel = mongoose.model("Activity", activitySchema);

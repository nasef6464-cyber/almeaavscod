import mongoose, { Schema } from "mongoose";

const topicSchema = new Schema(
  {
    id: { type: String, index: true, sparse: true },
    pathId: { type: String, required: true, index: true },
    subjectId: { type: String, required: true, index: true },
    sectionId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    parentId: { type: String, default: null, index: true },
    order: { type: Number, default: 0 },
    showOnPlatform: { type: Boolean, default: true },
    isLocked: { type: Boolean, default: false },
    lessonIds: { type: [String], default: [] },
    quizIds: { type: [String], default: [] },
    libraryItemIds: { type: [String], default: [] },
  },
  {
    timestamps: true,
  },
);

topicSchema.index({ pathId: 1, subjectId: 1, sectionId: 1, showOnPlatform: 1, order: 1 });
topicSchema.index({ parentId: 1, order: 1 });
topicSchema.index({ lessonIds: 1 });
topicSchema.index({ quizIds: 1 });
topicSchema.index({ libraryItemIds: 1 });

export const TopicModel = mongoose.model("Topic", topicSchema);

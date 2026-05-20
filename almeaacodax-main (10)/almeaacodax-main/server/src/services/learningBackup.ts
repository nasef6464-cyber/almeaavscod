import { Model } from "mongoose";
import { AccessCodeModel } from "../models/AccessCode.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { CourseModel } from "../models/Course.js";
import { DiscountCodeModel } from "../models/DiscountCode.js";
import { GroupModel } from "../models/Group.js";
import { HomepageSettingsModel } from "../models/HomepageSettings.js";
import { LessonModel } from "../models/Lesson.js";
import { LevelModel } from "../models/Level.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { PaymentSettingsModel } from "../models/PaymentSettings.js";
import { PathModel } from "../models/Path.js";
import { QuestionModel } from "../models/Question.js";
import { QuizModel } from "../models/Quiz.js";
import { SectionModel } from "../models/Section.js";
import { SkillModel } from "../models/Skill.js";
import { StudyPlanModel } from "../models/StudyPlan.js";
import { SubjectModel } from "../models/Subject.js";
import { TopicModel } from "../models/Topic.js";
import { AnnouncementAdModel } from "../models/AnnouncementAd.js";

export type LearningBackupCollection = {
  name: string;
  documents: Array<Record<string, unknown>>;
};

export type LearningBackupPayload = {
  schemaVersion: 1;
  kind: "almeaa-learning-content-backup";
  createdAt: string;
  database?: string;
  collections: LearningBackupCollection[];
  summary: Record<string, number>;
};

export type RestoreSummary = Record<string, { backup: number; current: number; action: string }>;

const learningCollections: Array<{ name: string; model: Model<any> }> = [
  { name: "paths", model: PathModel },
  { name: "levels", model: LevelModel },
  { name: "subjects", model: SubjectModel },
  { name: "sections", model: SectionModel },
  { name: "skills", model: SkillModel },
  { name: "topics", model: TopicModel },
  { name: "lessons", model: LessonModel },
  { name: "questions", model: QuestionModel },
  { name: "quizzes", model: QuizModel },
  { name: "courses", model: CourseModel },
  { name: "libraryItems", model: LibraryItemModel },
  { name: "groups", model: GroupModel },
  { name: "b2bPackages", model: B2BPackageModel },
  { name: "accessCodes", model: AccessCodeModel },
  { name: "studyPlans", model: StudyPlanModel },
  { name: "homepageSettings", model: HomepageSettingsModel },
  { name: "announcementAds", model: AnnouncementAdModel },
  { name: "paymentSettings", model: PaymentSettingsModel },
  { name: "discountCodes", model: DiscountCodeModel },
];

export async function createLearningBackup(databaseName?: string): Promise<LearningBackupPayload> {
  const collections: LearningBackupCollection[] = [];

  for (const collection of learningCollections) {
    const documents = await collection.model.find().lean();
    collections.push({ name: collection.name, documents });
  }

  return {
    schemaVersion: 1,
    kind: "almeaa-learning-content-backup",
    createdAt: new Date().toISOString(),
    database: databaseName,
    collections,
    summary: Object.fromEntries(collections.map((collection) => [collection.name, collection.documents.length])),
  };
}

export function assertLearningBackupPayload(payload: unknown): asserts payload is LearningBackupPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Backup file is not valid JSON");
  }

  const candidate = payload as Partial<LearningBackupPayload>;
  if (
    candidate.kind !== "almeaa-learning-content-backup" ||
    candidate.schemaVersion !== 1 ||
    !Array.isArray(candidate.collections)
  ) {
    throw new Error("Unsupported or invalid learning content backup file");
  }
}

const getDocumentId = (document: Record<string, unknown>) => document._id || document.id;

const stripImmutableId = (document: Record<string, unknown>) => {
  const { _id, ...rest } = document;
  return rest;
};

export async function restoreLearningBackup(
  payload: unknown,
  options: { apply?: boolean; replace?: boolean } = {},
): Promise<RestoreSummary> {
  assertLearningBackupPayload(payload);

  const backupMap = new Map(payload.collections.map((collection) => [collection.name, collection.documents || []]));
  const summary: RestoreSummary = {};
  const shouldApply = options.apply === true;
  const shouldReplace = shouldApply && options.replace === true;

  for (const collection of learningCollections) {
    const documents = backupMap.get(collection.name) || [];
    const current = await collection.model.countDocuments();
    summary[collection.name] = {
      backup: documents.length,
      current,
      action: shouldApply ? (shouldReplace ? "replace-and-upsert" : "upsert-only") : "dry-run",
    };

    if (!shouldApply) continue;

    if (shouldReplace) {
      await collection.model.deleteMany({});
    }

    for (const document of documents) {
      const documentId = getDocumentId(document);
      if (!documentId) continue;
      await collection.model.updateOne({ _id: documentId }, { $set: stripImmutableId(document) }, { upsert: true });
    }
  }

  return summary;
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import mongoose, { Model } from "mongoose";
import { env } from "../config/env.js";
import { CourseModel } from "../models/Course.js";
import { HomepageSettingsModel } from "../models/HomepageSettings.js";
import { LessonModel } from "../models/Lesson.js";
import { LevelModel } from "../models/Level.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { PathModel } from "../models/Path.js";
import { QuestionModel } from "../models/Question.js";
import { QuizModel } from "../models/Quiz.js";
import { SectionModel } from "../models/Section.js";
import { SkillModel } from "../models/Skill.js";
import { SubjectModel } from "../models/Subject.js";
import { TopicModel } from "../models/Topic.js";

type BackupCollection = {
  name: string;
  documents: Array<Record<string, unknown>>;
};

type BackupPayload = {
  schemaVersion: number;
  kind: string;
  createdAt?: string;
  collections: BackupCollection[];
};

const restoreCollections: Array<{ name: string; model: Model<any> }> = [
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
  { name: "homepageSettings", model: HomepageSettingsModel },
];

const hasFlag = (flag: string) => process.argv.includes(flag);

const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const getDocumentId = (document: Record<string, unknown>) => document._id || document.id;

const stripImmutableId = (document: Record<string, unknown>) => {
  const { _id, ...rest } = document;
  return rest;
};

async function run() {
  const fileArg = getArgValue("file") || process.argv.find((arg) => arg.endsWith(".json"));
  if (!fileArg) {
    throw new Error("Backup file is required. Example: npm run restore:learning -- --file ../backups/learning-content.json");
  }

  const backupPath = path.resolve(process.cwd(), fileArg);
  const shouldApply = hasFlag("--apply");
  const shouldReplace = hasFlag("--replace");
  const raw = await readFile(backupPath, "utf8");
  const payload = JSON.parse(raw) as BackupPayload;

  if (payload.kind !== "almeaa-learning-content-backup" || payload.schemaVersion !== 1) {
    throw new Error("Unsupported or invalid learning content backup file");
  }

  const backupMap = new Map(payload.collections.map((collection) => [collection.name, collection.documents || []]));
  const summary: Record<string, { backup: number; current?: number; action: string }> = {};

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });

  try {
    for (const collection of restoreCollections) {
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

    console.log(
      JSON.stringify(
        {
          ok: true,
          applied: shouldApply,
          replaced: shouldApply && shouldReplace,
          backupPath,
          createdAt: payload.createdAt,
          database: mongoose.connection.db?.databaseName || "unknown",
          summary,
          note: shouldApply
            ? "Restore completed."
            : "Dry run only. Re-run with --apply to write, and add --replace only when you intentionally want to clear managed collections first.",
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error("Learning content restore failed");
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

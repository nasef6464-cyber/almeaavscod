import { mkdir, writeFile } from "node:fs/promises";
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
  documents: unknown[];
};

const backupCollections: Array<{ name: string; model: Model<any> }> = [
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

const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const toSafeTimestamp = (date = new Date()) => date.toISOString().replace(/[:.]/g, "-");

async function run() {
  const backupDir = path.resolve(process.cwd(), getArgValue("dir") || "../backups");
  const fileName = getArgValue("file") || `learning-content-${toSafeTimestamp()}.json`;
  const outputPath = path.resolve(backupDir, fileName);

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });

  try {
    const collections: BackupCollection[] = [];
    for (const collection of backupCollections) {
      const documents = await collection.model.find().lean();
      collections.push({ name: collection.name, documents });
    }

    const payload = {
      schemaVersion: 1,
      kind: "almeaa-learning-content-backup",
      createdAt: new Date().toISOString(),
      database: mongoose.connection.db?.databaseName || "unknown",
      collections,
      summary: Object.fromEntries(collections.map((collection) => [collection.name, collection.documents.length])),
    };

    await mkdir(backupDir, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          ok: true,
          outputPath,
          database: payload.database,
          summary: payload.summary,
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
  console.error("Learning content backup failed");
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { CourseModel } from "../models/Course";
import { LessonModel } from "../models/Lesson";
import { LibraryItemModel } from "../models/LibraryItem";
import { PathModel } from "../models/Path";
import { QuizModel } from "../models/Quiz";
import { SubjectModel } from "../models/Subject";
import { TopicModel } from "../models/Topic";

type EnvMap = Record<string, string>;

const rootDir = path.resolve(process.cwd(), "..");
const envPath = path.join(rootDir, ".env.codex.local");

const parseEnvFile = (filePath: string): EnvMap => {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce<EnvMap>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return acc;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key) acc[key] = value;
      return acc;
    }, {});
};

const env = {
  ...process.env,
  ...parseEnvFile(envPath),
} as EnvMap;

const idOf = (item: any) => String(item?.id || item?._id || "");
const slug = (value: string) => value.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
const platformSampleVideoUrl =
  "https://www.youtube.com/watch?v=2BoPkKAm6uc";

const subjectTemplate = (subjectName: string, pathName = "") => {
  const searchableName = `${subjectName} ${pathName}`;
  const isVerbal = /لفظ|لغة|قراءة|نص/.test(searchableName);
  const isScience = /تحصيلي|رياض|فيز|كيم|أحيا|احيا|علوم/.test(searchableName);
  const title = isVerbal
    ? "فهم السياق والفكرة الرئيسية"
    : isScience
      ? "أساسيات المادة والقوانين المهمة"
      : "ترتيب العمليات والمهارات الأساسية";

  return {
    title,
    lessonTitle: isVerbal
      ? "شرح فهم السياق في النص"
      : isScience
        ? `شرح تأسيسي في ${subjectName}`
        : "شرح ترتيب العمليات والمهارات الأساسية",
    quizTitle: isVerbal
      ? "تدريب اللفظي: فهم السياق"
      : isScience
        ? `تدريب ${subjectName}: المفاهيم الأساسية`
        : "تدريب الكمي: العمليات والمهارات الأساسية",
    libraryTitle: isVerbal
      ? "ملخص اللفظي: فهم السياق"
      : isScience
        ? `ملخص ${subjectName}: أهم النقاط`
        : "ملخص الكمي: العمليات والمهارات الأساسية",
    courseTitle: isVerbal
      ? "تأسيس اللفظي: فهم المقروء"
      : isScience
        ? `تأسيس ${subjectName}`
        : "تأسيس الكمي: العمليات والمهارات الأساسية",
  };
};

async function run() {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment or .env.codex.local");
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });

  const activePaths = await PathModel.find({ isActive: { $ne: false } }).lean();
  const subjects = await SubjectModel.find({ pathId: { $in: activePaths.map(idOf) } }).lean();
  const targetSubjects = subjects;

  if (!targetSubjects.length) {
    console.log("No active subjects found to repair.");
    await mongoose.disconnect();
    return;
  }

  const summary: any[] = [];

  for (const subject of targetSubjects) {
    const subjectId = idOf(subject);
    const pathId = String(subject.pathId || "");
    const pathDoc = activePaths.find((item: any) => idOf(item) === pathId);
    const template = subjectTemplate(String(subject.name || ""), String(pathDoc?.name || ""));
    const suffix = slug(`${pathId}_${subjectId}`);

    const topicId = `topic_current_${suffix}_foundation`;
    const lessonId = `lesson_current_${suffix}_intro`;
    const quizId = `quiz_current_${suffix}_practice`;
    const libraryId = `lib_current_${suffix}_summary`;
    const courseId = `course_current_${suffix}_foundation`;

    await LessonModel.updateOne(
      { id: lessonId },
      {
        $set: {
          id: lessonId,
          title: template.lessonTitle,
          description: `درس تأسيسي مرتبط بمادة ${subject.name}`,
          pathId,
          subjectId,
          sectionId: null,
          type: "video",
          duration: "12 دقيقة",
          content: "شرح تمهيدي منظم للطالب داخل رحلة التعلم.",
          videoUrl: platformSampleVideoUrl,
          fileUrl: "",
          showOnPlatform: true,
          approvalStatus: "approved",
          ownerType: "platform",
          order: 1,
          isLocked: false,
          skillIds: [topicId],
        },
      },
      { upsert: true },
    );

    await QuizModel.updateOne(
      { id: quizId },
      {
        $set: {
          id: quizId,
          title: template.quizTitle,
          description: `تدريب سريع مرتبط بمادة ${subject.name}`,
          pathId,
          subjectId,
          sectionId: null,
          type: "bank",
          mode: "regular",
          settings: {
            showExplanations: true,
            showAnswers: true,
            maxAttempts: 3,
            passingScore: 60,
            timeLimit: 30,
          },
          access: { type: "free", price: 0, allowedGroupIds: [] },
          questionIds: [],
          skillIds: [topicId],
          isPublished: true,
          showOnPlatform: true,
          approvalStatus: "approved",
          ownerType: "platform",
        },
      },
      { upsert: true },
    );

    await LibraryItemModel.updateOne(
      { id: libraryId },
      {
        $set: {
          id: libraryId,
          title: template.libraryTitle,
          size: "1 صفحة",
          downloads: 0,
          type: "pdf",
          pathId,
          subjectId,
          sectionId: null,
          skillIds: [topicId],
          url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          showOnPlatform: true,
          approvalStatus: "approved",
          ownerType: "platform",
        },
      },
      { upsert: true },
    );

    await CourseModel.updateOne(
      { _id: courseId },
      {
        $set: {
          _id: courseId,
          title: template.courseTitle,
          thumbnail: "",
          instructor: "منصة المئة",
          price: 0,
          currency: "SAR",
          duration: 1,
          level: "Beginner",
          rating: 4.8,
          progress: 0,
          category: pathId,
          subject: subjectId,
          pathId,
          subjectId,
          sectionId: "",
          features: ["درس مرئي", "تدريب مباشر", "ملخص سريع"],
          description: `مسار تأسيسي مختصر في ${subject.name}`,
          instructorBio: "",
          modules: [
            {
              title: template.title,
              order: 1,
              lessons: [{ id: lessonId, title: template.lessonTitle, type: "video" }],
            },
          ],
          isPublished: true,
          showOnPlatform: true,
          isPackage: false,
          packageContentTypes: ["courses"],
          skills: [topicId],
          ownerType: "platform",
          approvalStatus: "approved",
        },
      },
      { upsert: true },
    );

    await TopicModel.updateOne(
      { id: topicId },
      {
        $set: {
          id: topicId,
          pathId,
          subjectId,
          sectionId: null,
          title: template.title,
          parentId: null,
          order: 1,
          showOnPlatform: true,
          isLocked: false,
          lessonIds: [lessonId],
          quizIds: [quizId],
        },
      },
      { upsert: true },
    );

    summary.push({
      path: pathDoc?.name || pathId,
      subject: subject.name,
      topicId,
      lessonId,
      quizId,
      libraryId,
      courseId,
    });
  }

  console.log(JSON.stringify({ repaired: summary.length, items: summary }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Learning content repair failed");
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

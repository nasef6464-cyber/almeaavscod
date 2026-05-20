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
type Status = "PASS" | "WARN" | "FAIL";

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

const isVisiblePath = (item: any) => item?.isActive !== false;
const isVisibleContent = (item: any) =>
  item?.showOnPlatform !== false &&
  item?.isPublished !== false &&
  (!item?.approvalStatus || item.approvalStatus === "approved");

const sanitizeVideoUrl = (rawUrl?: string | null) => {
  if (!rawUrl) return "";

  let trimmedUrl = rawUrl.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmedUrl) return "";

  trimmedUrl = trimmedUrl
    .replace(/^https?:\/\/https?:\/\//i, "https://")
    .replace(/^https?:\/\/:\/\//i, "https://")
    .replace(/^:\/\//, "https://")
    .replace(/^\/\//, "https://");

  if (/^(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(trimmedUrl)) {
    return `https://${trimmedUrl}`;
  }

  return trimmedUrl;
};

const getYouTubeVideoId = (rawUrl?: string | null) => {
  const normalizedUrl = sanitizeVideoUrl(rawUrl);
  if (!normalizedUrl) return "";

  const safeUrl = /^https?:\/\//i.test(normalizedUrl) ? normalizedUrl : `https://${normalizedUrl}`;

  try {
    const parsedUrl = new URL(safeUrl);
    const host = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") return parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
    if (host.includes("youtube.com")) {
      return (
        parsedUrl.searchParams.get("v") ||
        parsedUrl.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ||
        ""
      );
    }
  } catch {
    return "";
  }

  return "";
};

const hasPlayableLessonMedia = (lesson: any) =>
  Boolean(
    sanitizeVideoUrl(lesson?.videoUrl) ||
      String(lesson?.fileUrl || "").trim() ||
      String(lesson?.content || "").trim() ||
      String(lesson?.recordingUrl || "").trim(),
  );

const print = (status: Status, name: string, details: string) => {
  console.log(`${status} ${name} - ${details}`);
};

const summarize = (items: string[]) => (items.length ? items.slice(0, 8).join(", ") : "none");

async function run() {
  if (!env.MONGODB_URI) {
    print("FAIL", "MongoDB URI", "MONGODB_URI is missing from environment or .env.codex.local");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 12000 });

  const [paths, subjects, topics, lessons, quizzes, courses, libraryItems] = await Promise.all([
    PathModel.find().lean(),
    SubjectModel.find().lean(),
    TopicModel.find().lean(),
    LessonModel.find().lean(),
    QuizModel.find().lean(),
    CourseModel.find().lean(),
    LibraryItemModel.find().lean(),
  ]);

  const visiblePathIds = new Set(paths.filter(isVisiblePath).map(idOf));
  const visibleSubjectIds = new Set(subjects.filter((subject: any) => visiblePathIds.has(subject.pathId)).map(idOf));
  const visibleTopics = topics.filter((topic: any) => topic.showOnPlatform !== false && visiblePathIds.has(topic.pathId));
  const visibleLessons = lessons.filter((lesson: any) => isVisibleContent(lesson) && visiblePathIds.has(lesson.pathId));
  const visibleQuizzes = quizzes.filter((quiz: any) => isVisibleContent(quiz) && visiblePathIds.has(quiz.pathId));
  const visibleCourses = courses.filter((course: any) => isVisibleContent(course) && visiblePathIds.has(course.pathId || course.category));
  const visibleLibraryItems = libraryItems.filter((item: any) => isVisibleContent(item) && visiblePathIds.has(item.pathId));

  const lessonIds = new Set(visibleLessons.map(idOf));
  const quizIds = new Set(visibleQuizzes.map(idOf));
  const topicIds = new Set(visibleTopics.map(idOf));

  const missingTopicSubjects = visibleTopics
    .filter((topic: any) => topic.subjectId && !visibleSubjectIds.has(topic.subjectId))
    .map((topic: any) => `${idOf(topic)}:${topic.subjectId}`);
  const missingLessonRefs = visibleTopics.flatMap((topic: any) =>
    (topic.lessonIds || [])
      .map(String)
      .filter((lessonId: string) => lessonId && !lessonIds.has(lessonId))
      .map((lessonId: string) => `${idOf(topic)}->${lessonId}`),
  );
  const missingQuizRefs = visibleTopics.flatMap((topic: any) =>
    (topic.quizIds || [])
      .map(String)
      .filter((quizId: string) => quizId && !quizIds.has(quizId))
      .map((quizId: string) => `${idOf(topic)}->${quizId}`),
  );
  const unplayableLinkedLessons = visibleTopics.flatMap((topic: any) =>
    (topic.lessonIds || [])
      .map(String)
      .filter((lessonId: string) => {
        const lesson = visibleLessons.find((item: any) => idOf(item) === lessonId);
        return lesson && !hasPlayableLessonMedia(lesson);
      })
      .map((lessonId: string) => `${idOf(topic)}->${lessonId}`),
  );
  const orphanLessons = visibleLessons
    .filter((lesson: any) => !visibleTopics.some((topic: any) => (topic.lessonIds || []).map(String).includes(idOf(lesson))))
    .map((lesson: any) => idOf(lesson));
  const malformedYouTubeUrls = visibleLessons
    .filter((lesson: any) => {
      const url = sanitizeVideoUrl(lesson.videoUrl);
      if (!url) return false;
      return /youtu/i.test(url) && !getYouTubeVideoId(url);
    })
    .map((lesson: any) => idOf(lesson));

  const spaces = subjects
    .filter((subject: any) => visiblePathIds.has(subject.pathId))
    .map((subject: any) => {
      const subjectId = idOf(subject);
      const pathId = subject.pathId;
      return {
        pathId,
        subjectId,
        topics: visibleTopics.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId).length,
        lessons: visibleLessons.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId).length,
        quizzes: visibleQuizzes.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId).length,
        courses: visibleCourses.filter((item: any) => (item.pathId || item.category) === pathId && (item.subjectId || item.subject) === subjectId).length,
        library: visibleLibraryItems.filter((item: any) => item.pathId === pathId && item.subjectId === subjectId).length,
      };
    });

  const usableSpaces = spaces.filter((space) => space.topics + space.lessons + space.quizzes + space.courses + space.library > 0);
  const emptySpaces = spaces.filter((space) => space.topics + space.lessons + space.quizzes + space.courses + space.library === 0);

  print(
    usableSpaces.length > 0 ? "PASS" : "FAIL",
    "visible learning spaces",
    `usable=${usableSpaces.length}, empty=${emptySpaces.length}, paths=${visiblePathIds.size}`,
  );
  print(missingTopicSubjects.length === 0 ? "PASS" : "FAIL", "topic subject references", summarize(missingTopicSubjects));
  print(missingLessonRefs.length === 0 ? "PASS" : "FAIL", "topic lesson references", summarize(missingLessonRefs));
  print(missingQuizRefs.length === 0 ? "PASS" : "FAIL", "topic quiz references", summarize(missingQuizRefs));
  print(unplayableLinkedLessons.length === 0 ? "PASS" : "WARN", "linked lesson media", summarize(unplayableLinkedLessons));
  print(malformedYouTubeUrls.length === 0 ? "PASS" : "WARN", "youtube url format", summarize(malformedYouTubeUrls));
  print(orphanLessons.length === 0 ? "PASS" : "WARN", "visible orphan lessons", summarize(orphanLessons));

  console.log(
    JSON.stringify(
      {
        database: mongoose.connection.db?.databaseName || "unknown",
        counts: {
          paths: paths.length,
          subjects: subjects.length,
          topics: topics.length,
          lessons: lessons.length,
          quizzes: quizzes.length,
          courses: courses.length,
          libraryItems: libraryItems.length,
        },
        visible: {
          paths: visiblePathIds.size,
          topics: visibleTopics.length,
          lessons: visibleLessons.length,
          quizzes: visibleQuizzes.length,
          courses: visibleCourses.length,
          libraryItems: visibleLibraryItems.length,
        },
        issues: {
          emptySpaces,
          missingTopicSubjects,
          missingLessonRefs,
          missingQuizRefs,
          unplayableLinkedLessons,
          malformedYouTubeUrls,
          orphanLessons,
        },
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();

  if (usableSpaces.length === 0 || missingTopicSubjects.length || missingLessonRefs.length || missingQuizRefs.length) {
    process.exit(1);
  }
}

run().catch(async (error) => {
  print("FAIL", "learning audit", error instanceof Error ? error.message : String(error));
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});

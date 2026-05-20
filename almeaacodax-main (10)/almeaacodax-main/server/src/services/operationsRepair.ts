import { PathModel } from "../models/Path.js";
import { LessonModel } from "../models/Lesson.js";
import { QuizModel } from "../models/Quiz.js";
import { SubjectModel } from "../models/Subject.js";
import { TopicModel } from "../models/Topic.js";

export type OperationsRepairAction =
  | "hide-empty-published-quizzes"
  | "hide-empty-active-paths"
  | "unlink-unavailable-topic-lessons"
  | "unlink-unavailable-topic-quizzes";

export async function runOperationsRepair(action: OperationsRepairAction, apply = false) {
  if (action === "hide-empty-published-quizzes") {
    const targetQuizzes = await QuizModel.find({
      showOnPlatform: { $ne: false },
      isPublished: { $ne: false },
      $or: [{ questionIds: { $exists: false } }, { questionIds: { $size: 0 } }],
    }).lean();

    if (apply && targetQuizzes.length > 0) {
      await QuizModel.updateMany(
        { _id: { $in: targetQuizzes.map((quiz: any) => quiz._id) } },
        {
          $set: {
            showOnPlatform: false,
            isPublished: false,
            reviewerNotes: "أخفي تلقائيا من مركز التشخيص لأنه منشور بلا أسئلة.",
          },
        },
      );
    }

    return {
      action,
      applied: apply,
      affected: targetQuizzes.length,
      message: apply
        ? "تم إخفاء الاختبارات المنشورة بلا أسئلة عن الطلاب."
        : "سيتم إخفاء الاختبارات المنشورة بلا أسئلة عن الطلاب.",
      samples: targetQuizzes.slice(0, 8).map((quiz: any) => ({
        id: String(quiz.id || quiz._id),
        title: quiz.title,
      })),
    };
  }

  if (action === "hide-empty-active-paths") {
    const [paths, subjects] = await Promise.all([
      PathModel.find({ isActive: { $ne: false } }).lean(),
      SubjectModel.find().lean(),
    ]);
    const pathsWithSubjects = new Set(subjects.map((subject: any) => String(subject.pathId)));
    const targetPaths = paths.filter((path: any) => !pathsWithSubjects.has(String(path._id)));

    if (apply && targetPaths.length > 0) {
      await PathModel.updateMany(
        { _id: { $in: targetPaths.map((path: any) => path._id) } },
        {
          $set: {
            isActive: false,
            showInHome: false,
            showInNavbar: false,
          },
        },
      );
    }

    return {
      action,
      applied: apply,
      affected: targetPaths.length,
      message: apply
        ? "تم إخفاء المسارات النشطة التي لا تحتوي مواد."
        : "سيتم إخفاء المسارات النشطة التي لا تحتوي مواد.",
      samples: targetPaths.slice(0, 8).map((path: any) => ({
        id: String(path._id),
        title: path.name,
      })),
    };
  }

  if (action === "unlink-unavailable-topic-quizzes") {
    const [topics, quizzes] = await Promise.all([
      TopicModel.find({ quizIds: { $exists: true, $ne: [] } }).lean(),
      QuizModel.find({ showOnPlatform: { $ne: false }, isPublished: { $ne: false } }).lean(),
    ]);
    const visibleQuizIds = new Set(quizzes.map((quiz: any) => String(quiz.id || quiz._id)));
    const targetTopics = topics
      .map((topic: any) => {
        const quizIds = (topic.quizIds || []).map(String);
        const nextQuizIds = quizIds.filter((quizId: string) => visibleQuizIds.has(quizId));
        return {
          topic,
          nextQuizIds,
          removed: quizIds.length - nextQuizIds.length,
        };
      })
      .filter((item) => item.removed > 0);

    if (apply && targetTopics.length > 0) {
      await Promise.all(
        targetTopics.map((item) =>
          TopicModel.updateOne(
            { _id: item.topic._id },
            {
              $set: {
                quizIds: item.nextQuizIds,
              },
            },
          ),
        ),
      );
    }

    return {
      action,
      applied: apply,
      affected: targetTopics.reduce((total, item) => total + item.removed, 0),
      message: apply
        ? "تم تنظيف روابط الاختبارات غير المتاحة من الموضوعات."
        : "سيتم تنظيف روابط الاختبارات غير المتاحة من الموضوعات.",
      samples: targetTopics.slice(0, 8).map((item: any) => ({
        id: String(item.topic.id || item.topic._id),
        title: item.topic.title,
      })),
    };
  }

  if (action === "unlink-unavailable-topic-lessons") {
    const [topics, lessons] = await Promise.all([
      TopicModel.find({ lessonIds: { $exists: true, $ne: [] } }).lean(),
      LessonModel.find({
        showOnPlatform: { $ne: false },
        isPublished: { $ne: false },
        $or: [{ approvalStatus: { $exists: false } }, { approvalStatus: "approved" }],
      }).lean(),
    ]);
    const visibleLessonIds = new Set(lessons.map((lesson: any) => String(lesson.id || lesson._id)));
    const targetTopics = topics
      .map((topic: any) => {
        const lessonIds = (topic.lessonIds || []).map(String);
        const nextLessonIds = lessonIds.filter((lessonId: string) => visibleLessonIds.has(lessonId));
        return {
          topic,
          nextLessonIds,
          removed: lessonIds.length - nextLessonIds.length,
        };
      })
      .filter((item) => item.removed > 0);

    if (apply && targetTopics.length > 0) {
      await Promise.all(
        targetTopics.map((item) =>
          TopicModel.updateOne(
            { _id: item.topic._id },
            {
              $set: {
                lessonIds: item.nextLessonIds,
              },
            },
          ),
        ),
      );
    }

    return {
      action,
      applied: apply,
      affected: targetTopics.reduce((total, item) => total + item.removed, 0),
      message: apply
        ? "تم تنظيف روابط الدروس غير المتاحة من الموضوعات."
        : "سيتم تنظيف روابط الدروس غير المتاحة من الموضوعات.",
      samples: targetTopics.slice(0, 8).map((item: any) => ({
        id: String(item.topic.id || item.topic._id),
        title: item.topic.title,
      })),
    };
  }

  throw new Error("Unsupported repair action");
}

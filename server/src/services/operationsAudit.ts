import mongoose from "mongoose";
import { env } from "../config/env.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { CourseModel } from "../models/Course.js";
import { GroupModel } from "../models/Group.js";
import { HomepageSettingsModel } from "../models/HomepageSettings.js";
import { LessonModel } from "../models/Lesson.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { PathModel } from "../models/Path.js";
import { PaymentRequestModel } from "../models/PaymentRequest.js";
import { QuestionModel } from "../models/Question.js";
import { QuizModel } from "../models/Quiz.js";
import { SectionModel } from "../models/Section.js";
import { SkillModel } from "../models/Skill.js";
import { SubjectModel } from "../models/Subject.js";
import { TopicModel } from "../models/Topic.js";
import { UserModel } from "../models/User.js";

type Severity = "critical" | "warning" | "info" | "success";
type Area = "student_journey" | "content" | "assessment" | "media" | "accounts" | "payments" | "seo" | "security" | "deployment";

export type OperationsAuditCheck = {
  id: string;
  area: Area;
  severity: Severity;
  title: string;
  detail: string;
  count: number;
  action: string;
  owner: "admin" | "content" | "finance" | "technical";
  routeHint?: string;
  samples?: string[];
};

const idOf = (item: any) => String(item?.id || item?._id || "");

const normalizeUrl = (rawUrl?: string | null) => {
  if (!rawUrl) return "";
  return rawUrl
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^https?:\/\/https?:\/\//i, "https://")
    .replace(/^https?:\/\/:\/\//i, "https://")
    .replace(/^:\/\//, "https://")
    .replace(/^\/\//, "https://");
};

const isVisibleContent = (item: any) =>
  item?.showOnPlatform !== false &&
  item?.isPublished !== false &&
  (!item?.approvalStatus || item.approvalStatus === "approved");

const hasPlayableLessonMedia = (lesson: any) =>
  Boolean(
    normalizeUrl(lesson?.videoUrl) ||
      String(lesson?.fileUrl || "").trim() ||
      lesson?.contentPresent === true ||
      String(lesson?.content || "").trim() ||
      String(lesson?.recordingUrl || "").trim(),
  );

const sampleTitles = (items: any[], limit = 5) =>
  items
    .slice(0, limit)
    .map((item) => String(item?.title || item?.name || item?.email || idOf(item) || "عنصر بدون اسم"))
    .filter(Boolean);

const check = (payload: OperationsAuditCheck) => payload;

const severityWeight: Record<Severity, number> = {
  critical: 15,
  warning: 6,
  info: 2,
  success: 0,
};

const OPERATIONS_AUDIT_CACHE_TTL_MS = 30 * 1000;
const OPERATIONS_AUDIT_PATH_SELECT = "_id id name isActive";
const OPERATIONS_AUDIT_SUBJECT_SELECT = "_id id name pathId";
const OPERATIONS_AUDIT_SECTION_SELECT = "_id id name subjectId";
const OPERATIONS_AUDIT_SKILL_SELECT = "_id id name pathId subjectId sectionId";
const OPERATIONS_AUDIT_TOPIC_SELECT = "_id id title name pathId subjectId lessonIds quizIds showOnPlatform";
const OPERATIONS_AUDIT_QUIZ_SELECT =
  "_id id title name pathId subjectId sectionId questionIds skillIds showOnPlatform isPublished approvalStatus";
const OPERATIONS_AUDIT_QUESTION_SELECT =
  "_id id title name pathId subject sectionId skillIds type text options correctOptionIndex explanation showOnPlatform isPublished approvalStatus";
const OPERATIONS_AUDIT_COURSE_SELECT =
  "_id id title name pathId category subjectId subject showOnPlatform isPublished approvalStatus";
const OPERATIONS_AUDIT_LIBRARY_SELECT =
  "_id id title name pathId subjectId sectionId skillIds showOnPlatform isPublished approvalStatus";
const OPERATIONS_AUDIT_USER_SELECT =
  "_id id email role isActive managedPathIds managedSubjectIds linkedStudentIds";
const OPERATIONS_AUDIT_GROUP_SELECT = "_id id name type parentId";
const OPERATIONS_AUDIT_B2B_PACKAGE_SELECT = "_id id name title status maxStudents";
const OPERATIONS_AUDIT_PAYMENT_SELECT = "_id id status";

type OperationsAuditResult = {
  checkedAt: string;
  score: number;
  totals: {
    checks: number;
    issues: number;
    critical: number;
    warnings: number;
    info: number;
  };
  inventory: Record<string, number>;
  areaSummary: Record<Area, { total: number; issues: number; critical: number }>;
  checks: OperationsAuditCheck[];
  priorities: OperationsAuditCheck[];
};

let cachedOperationsAudit: { expiresAt: number; result: OperationsAuditResult } | null = null;
let pendingOperationsAudit: Promise<OperationsAuditResult> | null = null;

async function buildOperationsAudit(): Promise<OperationsAuditResult> {
  const [
    paths,
    subjects,
    sections,
    skills,
    topics,
    lessons,
    quizzes,
    questions,
    courses,
    libraryItems,
    users,
    groups,
    b2bPackages,
    paymentRequests,
    homepageSettings,
  ] = await Promise.all([
    PathModel.find().select(OPERATIONS_AUDIT_PATH_SELECT).lean(),
    SubjectModel.find().select(OPERATIONS_AUDIT_SUBJECT_SELECT).lean(),
    SectionModel.find().select(OPERATIONS_AUDIT_SECTION_SELECT).lean(),
    SkillModel.find().select(OPERATIONS_AUDIT_SKILL_SELECT).lean(),
    TopicModel.find().select(OPERATIONS_AUDIT_TOPIC_SELECT).lean(),
    LessonModel.aggregate([
      {
        $project: {
          _id: 1,
          id: 1,
          title: 1,
          name: 1,
          pathId: 1,
          subjectId: 1,
          sectionId: 1,
          skillIds: 1,
          showOnPlatform: 1,
          isPublished: 1,
          approvalStatus: 1,
          videoUrl: 1,
          fileUrl: 1,
          recordingUrl: 1,
          contentPresent: {
            $gt: [
              {
                $strLenCP: {
                  $ifNull: ["$content", ""],
                },
              },
              0,
            ],
          },
        },
      },
    ]),
    QuizModel.find().select(OPERATIONS_AUDIT_QUIZ_SELECT).lean(),
    QuestionModel.find().select(OPERATIONS_AUDIT_QUESTION_SELECT).lean(),
    CourseModel.find().select(OPERATIONS_AUDIT_COURSE_SELECT).lean(),
    LibraryItemModel.find().select(OPERATIONS_AUDIT_LIBRARY_SELECT).lean(),
    UserModel.find().select(OPERATIONS_AUDIT_USER_SELECT).lean(),
    GroupModel.find().select(OPERATIONS_AUDIT_GROUP_SELECT).lean(),
    B2BPackageModel.find().select(OPERATIONS_AUDIT_B2B_PACKAGE_SELECT).lean(),
    PaymentRequestModel.find().select(OPERATIONS_AUDIT_PAYMENT_SELECT).lean(),
    HomepageSettingsModel.findOne({ key: "default" }).select("hero featuredPathIds").lean(),
  ]);

  const pathIds = new Set(paths.map(idOf));
  const activePathIds = new Set(paths.filter((path: any) => path.isActive !== false).map(idOf));
  const subjectIds = new Set(subjects.map(idOf));
  const sectionIds = new Set(sections.map(idOf));
  const skillIds = new Set(skills.map(idOf));
  const visibleLessons = lessons.filter((lesson: any) => isVisibleContent(lesson) && activePathIds.has(lesson.pathId));
  const visibleQuizzes = quizzes.filter((quiz: any) => isVisibleContent(quiz) && activePathIds.has(quiz.pathId));
  const visibleCourses = courses.filter((course: any) => isVisibleContent(course) && activePathIds.has(course.pathId || course.category));
  const visibleLibraryItems = libraryItems.filter((item: any) => isVisibleContent(item) && activePathIds.has(item.pathId));
  const visibleTopics = topics.filter((topic: any) => topic.showOnPlatform !== false && activePathIds.has(topic.pathId));
  const lessonIds = new Set(visibleLessons.map(idOf));
  const quizIds = new Set(visibleQuizzes.map(idOf));
  const questionIds = new Set(questions.map(idOf));
  const lessonById = new Map(visibleLessons.map((lesson: any) => [idOf(lesson), lesson]));

  const activePathsWithoutSubjects = paths.filter((path: any) => path.isActive !== false && !subjects.some((subject: any) => subject.pathId === idOf(path)));
  const subjectsWithoutContent = subjects.filter((subject: any) => {
    const subjectId = idOf(subject);
    return (
      activePathIds.has(subject.pathId) &&
      !visibleTopics.some((item: any) => item.subjectId === subjectId) &&
      !visibleLessons.some((item: any) => item.subjectId === subjectId) &&
      !visibleQuizzes.some((item: any) => item.subjectId === subjectId) &&
      !visibleCourses.some((item: any) => (item.subjectId || item.subject) === subjectId) &&
      !visibleLibraryItems.some((item: any) => item.subjectId === subjectId)
    );
  });
  const topicsWithoutLinkedContent = visibleTopics.filter((topic: any) => (topic.lessonIds || []).length === 0 && (topic.quizIds || []).length === 0);
  const topicsWithMissingSubject = visibleTopics.filter((topic: any) => topic.subjectId && !subjectIds.has(topic.subjectId));
  const topicsWithMissingLessons = visibleTopics.filter((topic: any) => (topic.lessonIds || []).some((lessonId: string) => !lessonIds.has(String(lessonId))));
  const topicsWithMissingQuizzes = visibleTopics.filter((topic: any) => (topic.quizIds || []).some((quizId: string) => !quizIds.has(String(quizId))));
  const linkedUnplayableLessons = visibleTopics.flatMap((topic: any) =>
    (topic.lessonIds || [])
      .map((lessonId: string) => lessonById.get(String(lessonId)))
      .filter((lesson: any) => lesson && !hasPlayableLessonMedia(lesson)),
  );
  const visibleLessonsWithoutMedia = visibleLessons.filter((lesson: any) => !hasPlayableLessonMedia(lesson));
  const lessonsWithBrokenTaxonomy = lessons.filter(
    (lesson: any) =>
      (lesson.pathId && !pathIds.has(lesson.pathId)) ||
      (lesson.subjectId && !subjectIds.has(lesson.subjectId)) ||
      (lesson.sectionId && !sectionIds.has(lesson.sectionId)),
  );
  const orphanSkills = skills.filter(
    (skill: any) => !pathIds.has(skill.pathId) || !subjectIds.has(skill.subjectId) || !sectionIds.has(skill.sectionId),
  );
  const publishedQuizzesWithoutQuestions = visibleQuizzes.filter((quiz: any) => (quiz.questionIds || []).length === 0);
  const quizzesWithMissingQuestions = visibleQuizzes.filter((quiz: any) => (quiz.questionIds || []).some((questionId: string) => !questionIds.has(String(questionId))));
  const invalidQuestions = questions.filter((question: any) => {
    if (question.type === "essay") return !String(question.text || "").trim();
    const options = question.options || [];
    return (
      !String(question.text || "").trim() ||
      options.length < 2 ||
      question.correctOptionIndex < 0 ||
      question.correctOptionIndex >= options.length
    );
  });
  const questionsWithoutExplanations = questions.filter((question: any) => question.type !== "essay" && !String(question.explanation || "").trim());
  const visibleQuestions = questions.filter((question: any) => isVisibleContent(question) && activePathIds.has(question.pathId));
  const unskilledContent = [
    ...visibleLessons.filter((item: any) => (item.skillIds || []).length === 0),
    ...visibleQuestions.filter((item: any) => (item.skillIds || []).length === 0),
    ...visibleQuizzes.filter((item: any) => (item.skillIds || []).length === 0),
    ...visibleLibraryItems.filter((item: any) => (item.skillIds || []).length === 0),
  ];
  const pendingContent = [
    ...courses.filter((item: any) => item.approvalStatus === "pending_review"),
    ...lessons.filter((item: any) => item.approvalStatus === "pending_review"),
    ...quizzes.filter((item: any) => item.approvalStatus === "pending_review"),
    ...questions.filter((item: any) => item.approvalStatus === "pending_review"),
    ...libraryItems.filter((item: any) => item.approvalStatus === "pending_review"),
  ];
  const teachersWithoutScope = users.filter((user: any) => user.role === "teacher" && (user.managedPathIds || []).length === 0 && (user.managedSubjectIds || []).length === 0);
  const parentsWithoutChildren = users.filter((user: any) => user.role === "parent" && (user.linkedStudentIds || []).length === 0);
  const inactiveUsers = users.filter((user: any) => user.isActive === false);
  const pendingPayments = paymentRequests.filter((request: any) => request.status === "pending");
  const activeSchoolPackagesWithoutStudents = b2bPackages.filter((item: any) => item.status === "active" && item.maxStudents <= 0);
  const homepage = homepageSettings as any;
  const featuredPathIds = new Set<string>((homepage?.featuredPathIds || []).map(String));
  const invalidFeaturedPaths = [...featuredPathIds].filter((pathId) => !activePathIds.has(pathId));
  const heroNeedsAttention = !String(homepage?.hero?.description || "").trim() || !String(homepage?.hero?.imageUrl || "").trim();
  const defaultSecrets = env.JWT_SECRET.includes("super_secret") || env.JWT_SECRET.includes("change-me") || env.ADMIN_PASSWORD === "change-me";
  const isProduction = process.env.NODE_ENV === "production";
  const checks: OperationsAuditCheck[] = [
    check({
      id: "database-connected",
      area: "deployment",
      severity: mongoose.connection.readyState === 1 ? "success" : "critical",
      title: "اتصال قاعدة البيانات",
      detail: mongoose.connection.readyState === 1 ? `متصل بقاعدة ${mongoose.connection.db?.databaseName || "غير معروفة"}.` : "الخادم لا يرى MongoDB حاليا.",
      count: mongoose.connection.readyState === 1 ? 0 : 1,
      action: "راجع MONGODB_URI في Render ثم أعد النشر.",
      owner: "technical",
    }),
    check({
      id: "active-paths-without-subjects",
      area: "student_journey",
      severity: activePathsWithoutSubjects.length ? "critical" : "success",
      title: "مسارات نشطة بلا مواد",
      detail: activePathsWithoutSubjects.length ? "هذه المسارات تظهر للطالب لكن لا تحتوي مواد يفتحها." : "كل المسارات النشطة لها مواد مرتبطة.",
      count: activePathsWithoutSubjects.length,
      action: "افتح إدارة المسارات وأضف مادة واحدة على الأقل لكل مسار نشط.",
      owner: "content",
      routeHint: "#/admin-dashboard?tab=paths",
      samples: sampleTitles(activePathsWithoutSubjects),
    }),
    check({
      id: "subjects-without-content",
      area: "student_journey",
      severity: subjectsWithoutContent.length ? "critical" : "success",
      title: "مواد تظهر بلا محتوى",
      detail: subjectsWithoutContent.length ? "المادة تفتح للطالب لكنها لا تحتوي دروسا أو اختبارات أو ملفات." : "المواد الظاهرة فيها محتوى قابل للعرض.",
      count: subjectsWithoutContent.length,
      action: "اربط لكل مادة موضوعا ودرسا أو اختبارا منشورا قبل إعلانها للطلاب.",
      owner: "content",
      routeHint: "#/admin-dashboard?tab=paths",
      samples: sampleTitles(subjectsWithoutContent),
    }),
    check({
      id: "topics-without-linked-content",
      area: "student_journey",
      severity: topicsWithoutLinkedContent.length ? "warning" : "success",
      title: "موضوعات بلا دروس أو اختبارات",
      detail: topicsWithoutLinkedContent.length ? "هذه الموضوعات ستظهر كرحلة ناقصة داخل مساحة التعلم." : "الموضوعات مرتبطة بمحتوى.",
      count: topicsWithoutLinkedContent.length,
      action: "اربط الموضوع بدروس أو اختبارات من منشئ المسار.",
      owner: "content",
      samples: sampleTitles(topicsWithoutLinkedContent),
    }),
    check({
      id: "missing-topic-subjects",
      area: "content",
      severity: topicsWithMissingSubject.length ? "critical" : "success",
      title: "موضوعات مرتبطة بمادة غير موجودة",
      detail: topicsWithMissingSubject.length ? "يوجد موضوع يشير إلى مادة محذوفة أو غير موجودة." : "كل الموضوعات تشير إلى مواد صحيحة.",
      count: topicsWithMissingSubject.length,
      action: "أعد ربط الموضوعات بمادة صحيحة أو احذفها من المسار.",
      owner: "content",
      samples: sampleTitles(topicsWithMissingSubject),
    }),
    check({
      id: "missing-linked-lessons",
      area: "content",
      severity: topicsWithMissingLessons.length ? "critical" : "success",
      title: "روابط دروس مفقودة داخل الموضوعات",
      detail: topicsWithMissingLessons.length ? "بعض الموضوعات تشير إلى دروس محذوفة أو غير منشورة." : "كل روابط الدروس داخل الموضوعات سليمة.",
      count: topicsWithMissingLessons.length,
      action: "افتح الموضوع واحذف الرابط القديم أو اربطه بدرس منشور.",
      owner: "content",
      samples: sampleTitles(topicsWithMissingLessons),
    }),
    check({
      id: "missing-linked-quizzes",
      area: "assessment",
      severity: topicsWithMissingQuizzes.length ? "critical" : "success",
      title: "روابط اختبارات مفقودة داخل الموضوعات",
      detail: topicsWithMissingQuizzes.length ? "بعض الموضوعات تشير إلى اختبارات محذوفة أو غير منشورة." : "كل روابط الاختبارات داخل الموضوعات سليمة.",
      count: topicsWithMissingQuizzes.length,
      action: "أعد ربط الاختبار الصحيح أو احذف الرابط القديم من الموضوع.",
      owner: "content",
      samples: sampleTitles(topicsWithMissingQuizzes),
    }),
    check({
      id: "linked-lessons-unplayable",
      area: "media",
      severity: linkedUnplayableLessons.length ? "critical" : "success",
      title: "دروس مرتبطة لكن غير قابلة للتشغيل",
      detail: linkedUnplayableLessons.length ? "هذه الدروس موجودة في رحلة الطالب لكن لا تحتوي فيديو أو ملف أو محتوى نصي." : "الدروس المرتبطة بها محتوى قابل للتشغيل.",
      count: linkedUnplayableLessons.length,
      action: "أضف رابط فيديو أو ملف أو محتوى نصي للدرس قبل ربطه بالموضوع.",
      owner: "content",
      routeHint: "#/admin-dashboard?tab=lessons",
      samples: sampleTitles(linkedUnplayableLessons),
    }),
    check({
      id: "visible-lessons-without-media",
      area: "media",
      severity: visibleLessonsWithoutMedia.length ? "warning" : "success",
      title: "دروس منشورة بلا مادة تعليمية",
      detail: visibleLessonsWithoutMedia.length ? "دروس ظاهرة على المنصة لكنها بلا فيديو أو ملف أو نص." : "كل الدروس المنشورة تحمل مادة تعليمية.",
      count: visibleLessonsWithoutMedia.length,
      action: "راجع مركز الدروس وأكمل الوسائط قبل ترك الدرس منشورا.",
      owner: "content",
      samples: sampleTitles(visibleLessonsWithoutMedia),
    }),
    check({
      id: "published-quizzes-without-questions",
      area: "assessment",
      severity: publishedQuizzesWithoutQuestions.length ? "critical" : "success",
      title: "اختبارات منشورة بلا أسئلة",
      detail: publishedQuizzesWithoutQuestions.length ? "الطالب قد يفتح اختبارا فارغا." : "كل الاختبارات المنشورة تحتوي أسئلة.",
      count: publishedQuizzesWithoutQuestions.length,
      action: "أضف أسئلة للاختبار أو اخفه مؤقتا.",
      owner: "content",
      routeHint: "#/admin-dashboard?tab=quizzes",
      samples: sampleTitles(publishedQuizzesWithoutQuestions),
    }),
    check({
      id: "quizzes-with-missing-questions",
      area: "assessment",
      severity: quizzesWithMissingQuestions.length ? "critical" : "success",
      title: "اختبارات مرتبطة بأسئلة مفقودة",
      detail: quizzesWithMissingQuestions.length ? "يوجد اختبار يشير إلى أسئلة محذوفة من بنك الأسئلة." : "روابط الأسئلة داخل الاختبارات سليمة.",
      count: quizzesWithMissingQuestions.length,
      action: "استبدل الأسئلة المفقودة من داخل منشئ الاختبار.",
      owner: "content",
      samples: sampleTitles(quizzesWithMissingQuestions),
    }),
    check({
      id: "invalid-questions",
      area: "assessment",
      severity: invalidQuestions.length ? "critical" : "success",
      title: "أسئلة تحتاج تصحيح بنيوي",
      detail: invalidQuestions.length ? "أسئلة بها نص ناقص أو اختيارات غير كافية أو إجابة صحيحة خارج النطاق." : "بنية الأسئلة الأساسية سليمة.",
      count: invalidQuestions.length,
      action: "افتح مركز الأسئلة وصحح النص والاختيارات والإجابة الصحيحة.",
      owner: "content",
      routeHint: "#/admin-dashboard?tab=questions",
      samples: sampleTitles(invalidQuestions),
    }),
    check({
      id: "questions-without-explanations",
      area: "assessment",
      severity: questionsWithoutExplanations.length ? "warning" : "success",
      title: "أسئلة بلا شرح",
      detail: questionsWithoutExplanations.length ? "الطالب سيعرف الإجابة فقط بدون تفسير تعليمي." : "الأسئلة لها شروح تساعد الطالب.",
      count: questionsWithoutExplanations.length,
      action: "أضف شرحا مختصرا لكل سؤال مهم، خصوصا أسئلة القدرات والتحصيلي.",
      owner: "content",
      samples: sampleTitles(questionsWithoutExplanations),
    }),
    check({
      id: "unskilled-content",
      area: "content",
      severity: unskilledContent.length ? "warning" : "success",
      title: "محتوى غير مربوط بالمهارات",
      detail: unskilledContent.length ? "التقارير والتوصيات ستكون أضعف لأن المحتوى غير مربوط بمهارة." : "المحتوى مربوط بالمهارات بصورة جيدة.",
      count: unskilledContent.length,
      action: "اربط الدروس والأسئلة والاختبارات بمهارات حتى تعمل تقارير الضعف بدقة.",
      owner: "content",
      samples: sampleTitles(unskilledContent),
    }),
    check({
      id: "orphan-skills",
      area: "content",
      severity: orphanSkills.length ? "warning" : "success",
      title: "مهارات خارج شجرة صحيحة",
      detail: orphanSkills.length ? "مهارات تشير إلى مسار أو مادة أو قسم غير موجود." : "شجرة المهارات متماسكة.",
      count: orphanSkills.length,
      action: "راجع مركز المهارات وأعد ربط المهارات اليتيمة.",
      owner: "content",
      samples: sampleTitles(orphanSkills),
    }),
    check({
      id: "pending-content",
      area: "content",
      severity: pendingContent.length ? "info" : "success",
      title: "محتوى بانتظار الاعتماد",
      detail: pendingContent.length ? "يوجد محتوى جاهز للمراجعة قبل النشر للطلاب." : "لا توجد عناصر معلقة للمراجعة.",
      count: pendingContent.length,
      action: "راجع طابور الاعتماد يوميا حتى لا يتعطل نشر المحتوى.",
      owner: "content",
      samples: sampleTitles(pendingContent),
    }),
    check({
      id: "teachers-without-scope",
      area: "accounts",
      severity: teachersWithoutScope.length ? "warning" : "success",
      title: "معلمون بلا نطاق إدارة",
      detail: teachersWithoutScope.length ? "المعلم موجود لكنه لا يدير مسارا أو مادة، وقد تبدو لوحته فارغة." : "كل المعلمين لديهم نطاق واضح.",
      count: teachersWithoutScope.length,
      action: "حدد لكل معلم المسارات أو المواد التي يديرها.",
      owner: "admin",
      routeHint: "#/admin-dashboard?tab=users",
      samples: sampleTitles(teachersWithoutScope),
    }),
    check({
      id: "parents-without-children",
      area: "accounts",
      severity: parentsWithoutChildren.length ? "warning" : "success",
      title: "أولياء أمور بلا أبناء مرتبطين",
      detail: parentsWithoutChildren.length ? "ولي الأمر لن يرى متابعة مفيدة بدون طالب مرتبط." : "حسابات أولياء الأمور مرتبطة بطلاب.",
      count: parentsWithoutChildren.length,
      action: "اربط ولي الأمر بابنه من إدارة المستخدمين.",
      owner: "admin",
      samples: sampleTitles(parentsWithoutChildren),
    }),
    check({
      id: "inactive-users",
      area: "accounts",
      severity: inactiveUsers.length ? "info" : "success",
      title: "حسابات موقوفة",
      detail: inactiveUsers.length ? "يوجد حسابات موقوفة، راجعها للتأكد أنها مقصودة." : "لا توجد حسابات موقوفة حاليا.",
      count: inactiveUsers.length,
      action: "راجع الحسابات الموقوفة دوريا.",
      owner: "admin",
      samples: sampleTitles(inactiveUsers),
    }),
    check({
      id: "pending-payments",
      area: "payments",
      severity: pendingPayments.length ? "warning" : "success",
      title: "طلبات دفع تنتظر المراجعة",
      detail: pendingPayments.length ? "يوجد طلبات دفع قد تمنع الطالب من الوصول للمحتوى المدفوع حتى تراجعها." : "لا توجد طلبات دفع معلقة.",
      count: pendingPayments.length,
      action: "افتح المالية واعتمد أو ارفض الطلبات مع ملاحظة واضحة.",
      owner: "finance",
      routeHint: "#/admin-dashboard?tab=financial",
      samples: sampleTitles(pendingPayments),
    }),
    check({
      id: "school-packages-without-capacity",
      area: "payments",
      severity: activeSchoolPackagesWithoutStudents.length ? "warning" : "success",
      title: "باقات مدارس بلا سعة طلاب",
      detail: activeSchoolPackagesWithoutStudents.length ? "باقات نشطة للمدارس لكن maxStudents يساوي صفر." : "باقات المدارس النشطة لها سعة واضحة.",
      count: activeSchoolPackagesWithoutStudents.length,
      action: "حدد عدد الطلاب المتاح لكل باقة مدرسة.",
      owner: "finance",
      samples: sampleTitles(activeSchoolPackagesWithoutStudents),
    }),
    check({
      id: "homepage-hero-assets",
      area: "seo",
      severity: heroNeedsAttention ? "warning" : "success",
      title: "واجهة الصفحة الرئيسية",
      detail: heroNeedsAttention ? "الصفحة الرئيسية تحتاج وصفا وصورة واضحة لظهور أقوى وتجربة أفضل." : "واجهة الصفحة الرئيسية مكتملة أساسيا.",
      count: heroNeedsAttention ? 1 : 0,
      action: "أكمل وصف الهيرو وصورة رئيسية مناسبة من إدارة الصفحة الرئيسية.",
      owner: "admin",
      routeHint: "#/admin-dashboard?tab=homepage",
    }),
    check({
      id: "invalid-featured-paths",
      area: "seo",
      severity: invalidFeaturedPaths.length ? "warning" : "success",
      title: "مسارات مميزة غير صالحة في الرئيسية",
      detail: invalidFeaturedPaths.length ? "الصفحة الرئيسية تشير إلى مسارات محذوفة أو غير نشطة." : "المسارات المميزة في الرئيسية سليمة.",
      count: invalidFeaturedPaths.length,
      action: "حدّث اختيارات المسارات المهمة في إدارة الصفحة الرئيسية.",
      owner: "admin",
    }),
    check({
      id: "security-production",
      area: "security",
      severity: isProduction && !env.DEV_LOCAL_ADMIN_BYPASS ? "success" : "critical",
      title: "وضع الإنتاج وحماية الدخول",
      detail: isProduction && !env.DEV_LOCAL_ADMIN_BYPASS ? "الخادم يعمل كوضع إنتاج ولا يسمح بتجاوز مدير محلي." : "يجب التأكد من NODE_ENV=production وإغلاق DEV_LOCAL_ADMIN_BYPASS على الإنتاج.",
      count: isProduction && !env.DEV_LOCAL_ADMIN_BYPASS ? 0 : 1,
      action: "راجع متغيرات Render: NODE_ENV=production و DEV_LOCAL_ADMIN_BYPASS=false.",
      owner: "technical",
    }),
    check({
      id: "security-secrets",
      area: "security",
      severity: defaultSecrets || env.JWT_SECRET.length < 32 ? "warning" : "success",
      title: "قوة أسرار الخادم",
      detail: defaultSecrets || env.JWT_SECRET.length < 32 ? "بعض الأسرار تبدو قصيرة أو قريبة من القيم الافتراضية." : "أسرار الخادم ليست قصيرة أو افتراضية.",
      count: defaultSecrets || env.JWT_SECRET.length < 32 ? 1 : 0,
      action: "استخدم JWT_SECRET طويل عشوائي، ولا تنشر كلمات المرور في الصور أو المحادثات.",
      owner: "technical",
    }),
  ];

  const issueChecks = checks.filter((item) => item.severity !== "success" && item.count > 0);
  const penalty = issueChecks.reduce((total, item) => total + severityWeight[item.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const areaSummary = checks.reduce<Record<Area, { total: number; issues: number; critical: number }>>((summary, item) => {
    summary[item.area] ||= { total: 0, issues: 0, critical: 0 };
    summary[item.area].total += 1;
    if (item.severity !== "success" && item.count > 0) summary[item.area].issues += 1;
    if (item.severity === "critical" && item.count > 0) summary[item.area].critical += 1;
    return summary;
  }, {} as Record<Area, { total: number; issues: number; critical: number }>);

  return {
    checkedAt: new Date().toISOString(),
    score,
    totals: {
      checks: checks.length,
      issues: issueChecks.length,
      critical: issueChecks.filter((item) => item.severity === "critical").length,
      warnings: issueChecks.filter((item) => item.severity === "warning").length,
      info: issueChecks.filter((item) => item.severity === "info").length,
    },
    inventory: {
      paths: paths.length,
      subjects: subjects.length,
      topics: topics.length,
      lessons: lessons.length,
      quizzes: quizzes.length,
      questions: questions.length,
      users: users.length,
      groups: groups.length,
    },
    areaSummary,
    checks,
    priorities: issueChecks
      .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity] || b.count - a.count)
      .slice(0, 8),
  };
}

export async function createOperationsAudit() {
  const now = Date.now();
  if (cachedOperationsAudit && cachedOperationsAudit.expiresAt > now) {
    return cachedOperationsAudit.result;
  }

  if (pendingOperationsAudit) {
    return pendingOperationsAudit;
  }

  pendingOperationsAudit = buildOperationsAudit()
    .then((result) => {
      cachedOperationsAudit = {
        expiresAt: Date.now() + OPERATIONS_AUDIT_CACHE_TTL_MS,
        result,
      };
      return result;
    })
    .finally(() => {
      pendingOperationsAudit = null;
    });

  return pendingOperationsAudit;
}

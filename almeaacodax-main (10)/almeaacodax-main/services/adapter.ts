import { api } from "./api";
import { AccessCode, AnnouncementAd, B2BPackage, CategoryLevel, CategoryPath, CategorySection, CategorySubject, Course, Group, Lesson, LibraryItem, Module, Question, Quiz, Skill, StudyPlan, Topic } from "../types";
import { sanitizeArabicText } from "../utils/sanitizeMojibakeArabic";

const USE_REAL_API =
  (import.meta as ImportMeta & { env?: Record<string, string | boolean> }).env?.PROD === true ||
  (import.meta as ImportMeta & { env?: Record<string, string | boolean> }).env?.VITE_USE_REAL_API !== "false";

const FALLBACK_THUMBNAIL = "https://picsum.photos/seed/course-fallback/400/250";
const cleanText = (value: unknown) => sanitizeArabicText(String(value || "")).trim();

const toTimestamp = (value: unknown, fallback = Date.now()) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    const dateValue = new Date(value).getTime();
    if (Number.isFinite(dateValue)) {
      return dateValue;
    }
  }

  const fallbackValue = typeof fallback === "number" ? fallback : Date.now();
  return Number.isFinite(fallbackValue) ? fallbackValue : Date.now();
};

const normalizePath = (path: any): CategoryPath => ({
  id: String(path?.id || path?._id || ""),
  name: cleanText(path?.name),
  color: path?.color,
  icon: path?.icon,
  iconUrl: path?.iconUrl,
  iconStyle: path?.iconStyle,
  showInNavbar: path?.showInNavbar,
  showInHome: path?.showInHome,
  isActive: path?.isActive,
  parentPathId: path?.parentPathId || undefined,
  description: path?.description,
  settings: path?.settings,
});

const normalizeLevel = (level: any): CategoryLevel => ({
  id: String(level?.id || level?._id || ""),
  pathId: String(level?.pathId || ""),
  name: cleanText(level?.name),
});

const normalizeSubject = (subject: any): CategorySubject => ({
  id: String(subject?.id || subject?._id || ""),
  pathId: String(subject?.pathId || ""),
  levelId: subject?.levelId || undefined,
  name: cleanText(subject?.name),
  color: subject?.color,
  icon: subject?.icon,
  iconUrl: subject?.iconUrl,
  iconStyle: subject?.iconStyle,
  settings: subject?.settings,
});

const normalizeStudyPlan = (plan: any): StudyPlan => ({
  ...plan,
  id: String(plan?.id || plan?._id || ""),
  userId: String(plan?.userId || ""),
  name: String(plan?.name || ""),
  pathId: String(plan?.pathId || ""),
  subjectIds: Array.isArray(plan?.subjectIds) ? plan.subjectIds.map(String) : [],
  courseIds: Array.isArray(plan?.courseIds) ? plan.courseIds.map(String) : [],
  startDate: String(plan?.startDate || ""),
  endDate: String(plan?.endDate || ""),
  skipCompletedQuizzes: plan?.skipCompletedQuizzes !== false,
  offDays: Array.isArray(plan?.offDays) ? plan.offDays.map(String) : [],
  dailyMinutes: Number(plan?.dailyMinutes || 90),
  preferredStartTime: plan?.preferredStartTime || "17:00",
  status: plan?.status === "archived" ? "archived" : "active",
  createdAt: toTimestamp(plan?.createdAt),
  updatedAt: toTimestamp(plan?.updatedAt),
});

const normalizeSection = (section: any): CategorySection => ({
  id: String(section?.id || section?._id || ""),
  subjectId: String(section?.subjectId || ""),
  name: cleanText(section?.name),
});

const normalizeSkill = (skill: any): Skill => ({
  id: String(skill?.id || skill?._id || ""),
  name: cleanText(skill?.name),
  pathId: String(skill?.pathId || ""),
  subjectId: String(skill?.subjectId || ""),
  sectionId: String(skill?.sectionId || ""),
  description: skill?.description || "",
  lessonIds: Array.isArray(skill?.lessonIds) ? skill.lessonIds.map(String) : [],
  questionIds: Array.isArray(skill?.questionIds) ? skill.questionIds.map(String) : [],
  createdAt: toTimestamp(skill?.createdAt),
});

const normalizeLesson = (lesson: any, moduleIndex: number, lessonIndex: number): Lesson => ({
  id: String(lesson?.id || lesson?._id || `lesson-${moduleIndex + 1}-${lessonIndex + 1}`),
  title: cleanText(lesson?.title || `الدرس ${lessonIndex + 1}`),
  description: lesson?.description || "",
  type: lesson?.type || "video",
  duration: String(lesson?.duration || "0 دقيقة"),
  isCompleted: Boolean(lesson?.isCompleted),
  content: lesson?.content,
  videoUrl: lesson?.videoUrl,
  videoSource: lesson?.videoSource,
  interactiveQuestions: Array.isArray(lesson?.interactiveQuestions) ? lesson.interactiveQuestions : [],
  quizId: lesson?.quizId,
  fileUrl: lesson?.fileUrl,
  assignmentDetails: lesson?.assignmentDetails,
  meetingUrl: lesson?.meetingUrl,
  meetingDate: lesson?.meetingDate,
  recordingUrl: lesson?.recordingUrl,
  joinInstructions: lesson?.joinInstructions,
  showRecordingOnPlatform: Boolean(lesson?.showRecordingOnPlatform),
  showOnPlatform: lesson?.showOnPlatform !== false,
  isLocked: Boolean(lesson?.isLocked),
  accessControl: lesson?.accessControl,
  allowedGroupIds: Array.isArray(lesson?.allowedGroupIds) ? lesson.allowedGroupIds : [],
  order: Number(lesson?.order ?? lessonIndex),
  skillIds: Array.isArray(lesson?.skillIds) ? lesson.skillIds : [],
  pathId: lesson?.pathId,
  subjectId: lesson?.subjectId,
  sectionId: lesson?.sectionId,
  ownerType: lesson?.ownerType,
  ownerId: lesson?.ownerId || undefined,
  createdBy: lesson?.createdBy || undefined,
  assignedTeacherId: lesson?.assignedTeacherId || undefined,
  approvalStatus: lesson?.approvalStatus,
  approvedBy: lesson?.approvedBy || undefined,
  approvedAt: typeof lesson?.approvedAt === "number" ? lesson.approvedAt : undefined,
  reviewerNotes: lesson?.reviewerNotes || undefined,
  revenueSharePercentage: typeof lesson?.revenueSharePercentage === "number" ? lesson.revenueSharePercentage : undefined,
});

const normalizeTopic = (topic: any): Topic => ({
  id: String(topic?.id || topic?._id || ""),
  pathId: topic?.pathId || undefined,
  subjectId: String(topic?.subjectId || ""),
  sectionId: topic?.sectionId || undefined,
  title: cleanText(topic?.title),
  parentId: topic?.parentId || null,
  order: Number(topic?.order ?? 0),
  showOnPlatform: topic?.showOnPlatform !== false,
  isLocked: topic?.isLocked === true,
  lessonIds: Array.isArray(topic?.lessonIds) ? topic.lessonIds.map(String) : [],
  quizIds: Array.isArray(topic?.quizIds) ? topic.quizIds.map(String) : [],
  libraryItemIds: Array.isArray(topic?.libraryItemIds) ? topic.libraryItemIds.map(String) : [],
});

const normalizeLibraryItem = (item: any): LibraryItem => ({
  id: String(item?.id || item?._id || ""),
  title: cleanText(item?.title),
  size: String(item?.size || ""),
  downloads: Number(item?.downloads ?? 0),
  type: item?.type || "pdf",
  pathId: item?.pathId ? String(item.pathId) : undefined,
  subjectId: String(item?.subjectId || ""),
  sectionId: item?.sectionId ? String(item.sectionId) : undefined,
  skillIds: Array.isArray(item?.skillIds) ? item.skillIds.map((value: unknown) => String(value)) : [],
  url: item?.url || undefined,
  showOnPlatform: item?.showOnPlatform !== false,
  isLocked: item?.isLocked === true,
  ownerType: item?.ownerType,
  ownerId: item?.ownerId || undefined,
  createdBy: item?.createdBy || undefined,
  assignedTeacherId: item?.assignedTeacherId || undefined,
  approvalStatus: item?.approvalStatus,
  approvedBy: item?.approvedBy || undefined,
  approvedAt: typeof item?.approvedAt === "number" ? item.approvedAt : undefined,
  reviewerNotes: item?.reviewerNotes || undefined,
  revenueSharePercentage: typeof item?.revenueSharePercentage === "number" ? item.revenueSharePercentage : undefined,
});

const normalizeGroup = (group: any): Group => ({
  id: String(group?.id || group?._id || ""),
  name: cleanText(group?.name),
  type: group?.type || "CLASS",
  parentId: group?.parentId || undefined,
  ownerId: String(group?.ownerId || ""),
  supervisorIds: Array.isArray(group?.supervisorIds) ? group.supervisorIds.map(String) : [],
  studentIds: Array.isArray(group?.studentIds) ? group.studentIds.map(String) : [],
  courseIds: Array.isArray(group?.courseIds) ? group.courseIds.map(String) : [],
  createdAt: toTimestamp(group?.createdAt),
  metadata: group?.metadata,
  totalStudents: typeof group?.totalStudents === "number" ? group.totalStudents : undefined,
  totalSupervisors: typeof group?.totalSupervisors === "number" ? group.totalSupervisors : undefined,
  totalCourses: typeof group?.totalCourses === "number" ? group.totalCourses : undefined,
  activityScore: typeof group?.activityScore === "number" ? group.activityScore : undefined,
  performanceScore: typeof group?.performanceScore === "number" ? group.performanceScore : undefined,
});

const normalizeB2BPackage = (pkg: any): B2BPackage => ({
  id: String(pkg?.id || pkg?._id || ""),
  schoolId: String(pkg?.schoolId || ""),
  name: cleanText(pkg?.name),
  assignedTeacherId: pkg?.assignedTeacherId || undefined,
  revenueSharePercentage: typeof pkg?.revenueSharePercentage === "number" ? pkg.revenueSharePercentage : undefined,
  courseIds: Array.isArray(pkg?.courseIds) ? pkg.courseIds.map(String) : [],
  contentTypes: Array.isArray(pkg?.contentTypes) && pkg.contentTypes.length ? pkg.contentTypes : ["all"],
  pathIds: Array.isArray(pkg?.pathIds) ? pkg.pathIds.map(String) : [],
  subjectIds: Array.isArray(pkg?.subjectIds) ? pkg.subjectIds.map(String) : [],
  type: pkg?.type || "free_access",
  discountPercentage: typeof pkg?.discountPercentage === "number" ? pkg.discountPercentage : undefined,
  maxStudents: Number(pkg?.maxStudents ?? 0),
  status: pkg?.status || "active",
  createdAt: toTimestamp(pkg?.createdAt),
});

const normalizeAccessCode = (code: any): AccessCode => ({
  id: String(code?.id || code?._id || ""),
  code: String(code?.code || ""),
  schoolId: String(code?.schoolId || ""),
  packageId: String(code?.packageId || ""),
  maxUses: Number(code?.maxUses ?? 1),
  currentUses: Number(code?.currentUses ?? 0),
  expiresAt: Number(code?.expiresAt ?? Date.now()),
  createdAt: toTimestamp(code?.createdAt),
});

const normalizeAnnouncementAd = (ad: any): AnnouncementAd => ({
  id: String(ad?.id || ad?._id || ""),
  title: cleanText(ad?.title),
  body: ad?.body || "",
  imageUrl: ad?.imageUrl || "",
  ctaLabel: ad?.ctaLabel || "",
  ctaUrl: ad?.ctaUrl || "",
  audience: ["all", "guest", "student", "parent", "staff"].includes(ad?.audience) ? ad.audience : "all",
  displayMode: ["modal", "top-banner"].includes(ad?.displayMode) ? ad.displayMode : "modal",
  frequency: ["always", "session", "once"].includes(ad?.frequency) ? ad.frequency : "session",
  imageFit: ["cover", "contain"].includes(ad?.imageFit) ? ad.imageFit : "cover",
  delaySeconds: Math.max(0, Math.min(30, Number(ad?.delaySeconds ?? 0))),
  isActive: ad?.isActive !== false,
  priority: Number(ad?.priority ?? 0),
  startsAt: typeof ad?.startsAt === "number" ? ad.startsAt : undefined,
  endsAt: typeof ad?.endsAt === "number" ? ad.endsAt : undefined,
  createdAt: toTimestamp(ad?.createdAt),
  updatedAt: typeof ad?.updatedAt === "number" ? ad.updatedAt : undefined,
});

const normalizeModule = (module: any, moduleIndex: number): Module => ({
  id: String(module?.id || module?._id || `module-${moduleIndex + 1}`),
  title: cleanText(module?.title || `الوحدة ${moduleIndex + 1}`),
  order: Number(module?.order ?? moduleIndex),
  lessons: Array.isArray(module?.lessons)
    ? module.lessons.map((lesson: any, lessonIndex: number) => normalizeLesson(lesson, moduleIndex, lessonIndex))
    : [],
});

const normalizeCourse = (course: any): Course => ({
  id: String(course?.id || course?._id || ""),
  title: cleanText(course?.title || "دورة بدون عنوان"),
  thumbnail: course?.thumbnail || FALLBACK_THUMBNAIL,
  instructor: cleanText(course?.instructor || "فريق المنصة"),
  price: Number(course?.price ?? 0),
  currency: String(course?.currency || "ر.س"),
  duration: Number(course?.duration ?? 0),
  level: course?.level || "Beginner",
  rating: Number(course?.rating ?? 0),
  progress: Number(course?.progress ?? 0),
  category: cleanText(course?.category || "عام"),
  subject: cleanText(course?.subject || ""),
  pathId: course?.pathId ? String(course.pathId) : undefined,
  subjectId: course?.subjectId ? String(course.subjectId) : undefined,
  sectionId: course?.sectionId ? String(course.sectionId) : undefined,
  features: Array.isArray(course?.features) ? course.features : [],
  description: course?.description || "",
  instructorBio: course?.instructorBio || "",
  modules: Array.isArray(course?.modules) ? course.modules.map((module: any, index: number) => normalizeModule(module, index)) : [],
  isPurchased: Boolean(course?.isPurchased),
  isPackage: Boolean(course?.isPackage),
  packageType: course?.packageType,
  packageContentTypes: Array.isArray(course?.packageContentTypes) ? course.packageContentTypes : undefined,
  originalPrice: typeof course?.originalPrice === "number" ? course.originalPrice : undefined,
  includedCourses: Array.isArray(course?.includedCourses) ? course.includedCourses : [],
  studentCount: typeof course?.studentCount === "number" ? course.studentCount : undefined,
  weeksCount: typeof course?.weeksCount === "number" ? course.weeksCount : undefined,
  previewVideoUrl: course?.previewVideoUrl,
  files: Array.isArray(course?.files) ? course.files : [],
  qa: Array.isArray(course?.qa) ? course.qa : [],
  isPublished: Boolean(course?.isPublished),
  showOnPlatform: course?.showOnPlatform !== false,
  prerequisiteCourseIds: Array.isArray(course?.prerequisiteCourseIds) ? course.prerequisiteCourseIds : [],
  dripContentEnabled: Boolean(course?.dripContentEnabled),
  certificateEnabled: Boolean(course?.certificateEnabled),
  fakeRating: typeof course?.fakeRating === "number" ? course.fakeRating : undefined,
  fakeStudentsCount: typeof course?.fakeStudentsCount === "number" ? course.fakeStudentsCount : undefined,
  skills: Array.isArray(course?.skills) ? course.skills : [],
  ownerType: course?.ownerType,
  ownerId: course?.ownerId || undefined,
  createdBy: course?.createdBy || undefined,
  assignedTeacherId: course?.assignedTeacherId || undefined,
  approvalStatus: course?.approvalStatus,
  approvedBy: course?.approvedBy || undefined,
  approvedAt: typeof course?.approvedAt === "number" ? course.approvedAt : undefined,
  reviewerNotes: course?.reviewerNotes || undefined,
  revenueSharePercentage: typeof course?.revenueSharePercentage === "number" ? course.revenueSharePercentage : undefined,
});

const normalizeQuestion = (question: any): Question => ({
  id: String(question?.id || question?._id || ""),
  text: cleanText(question?.text),
  options: Array.isArray(question?.options) ? question.options.map(String) : [],
  correctOptionIndex: Number(question?.correctOptionIndex ?? 0),
  explanation: question?.explanation || "",
  videoUrl: question?.videoUrl,
  imageUrl: question?.imageUrl,
  skillIds: Array.isArray(question?.skillIds) ? question.skillIds.map(String) : [],
  pathId: question?.pathId,
  subject: cleanText(question?.subject || ""),
  sectionId: question?.sectionId,
  difficulty: question?.difficulty || "Medium",
  type: question?.type || "mcq",
  ownerType: question?.ownerType,
  ownerId: question?.ownerId || undefined,
  createdBy: question?.createdBy || undefined,
  assignedTeacherId: question?.assignedTeacherId || undefined,
  approvalStatus: question?.approvalStatus,
  approvedBy: question?.approvedBy || undefined,
  approvedAt: typeof question?.approvedAt === "number" ? question.approvedAt : undefined,
  reviewerNotes: question?.reviewerNotes || undefined,
  revenueSharePercentage: typeof question?.revenueSharePercentage === "number" ? question.revenueSharePercentage : undefined,
});

const normalizeQuizLearningPlacements = (placements: any): Quiz["learningPlacements"] =>
  Array.isArray(placements)
    ? placements
        .map((placement: any) => ({
          pathId: String(placement?.pathId || ""),
          subjectId: placement?.subjectId ? String(placement.subjectId) : undefined,
          slot: placement?.slot,
          isVisible: placement?.isVisible !== false,
          order: typeof placement?.order === "number" ? placement.order : 0,
          createdAt: toTimestamp(placement?.createdAt, Date.now()),
          updatedAt: toTimestamp(placement?.updatedAt, Date.now()),
        }))
        .filter((placement) => placement.pathId && ["training", "tests", "foundation", "course"].includes(String(placement.slot)))
    : undefined;

const normalizeQuiz = (quiz: any): Quiz => ({
  id: String(quiz?.id || quiz?._id || ""),
  title: cleanText(quiz?.title),
  description: quiz?.description || "",
  pathId: String(quiz?.pathId || ""),
  subjectId: String(quiz?.subjectId || ""),
  sectionId: quiz?.sectionId || undefined,
  type: quiz?.type || "quiz",
  placement: quiz?.placement,
  showInTraining: typeof quiz?.showInTraining === "boolean" ? quiz.showInTraining : undefined,
  showInMock: typeof quiz?.showInMock === "boolean" ? quiz.showInMock : undefined,
  learningPlacements: normalizeQuizLearningPlacements(quiz?.learningPlacements),
  mockExam: quiz?.mockExam
    ? {
        enabled: quiz.mockExam.enabled === true,
        pathId: String(quiz.mockExam.pathId || ""),
        sections: Array.isArray(quiz.mockExam.sections)
          ? quiz.mockExam.sections.map((section: any) => ({
              id: String(section?.id || ""),
              title: cleanText(section?.title),
              subjectId: section?.subjectId ? String(section.subjectId) : undefined,
              questionIds: Array.isArray(section?.questionIds) ? section.questionIds.map(String) : [],
              timeLimit: typeof section?.timeLimit === "number" ? section.timeLimit : undefined,
              order: typeof section?.order === "number" ? section.order : 0,
            }))
          : [],
      }
    : undefined,
  mode: quiz?.mode || "regular",
  settings: {
    showExplanations: Boolean(quiz?.settings?.showExplanations),
    showAnswers: Boolean(quiz?.settings?.showAnswers),
    showResultsReport: quiz?.settings?.showResultsReport !== false,
    returnToSourceOnFinish: quiz?.settings?.returnToSourceOnFinish === true,
    maxAttempts: Number(quiz?.settings?.maxAttempts ?? 1),
    passingScore: Number(quiz?.settings?.passingScore ?? 50),
    timeLimit: typeof quiz?.settings?.timeLimit === "number" ? quiz.settings.timeLimit : undefined,
    randomizeQuestions: quiz?.settings?.randomizeQuestions !== false,
    showProgressBar: quiz?.settings?.showProgressBar !== false,
    requireAnswerBeforeNext: quiz?.settings?.requireAnswerBeforeNext === true,
    allowQuestionReview: quiz?.settings?.allowQuestionReview !== false,
    optionLayout: ["auto", "horizontal", "two_columns"].includes(quiz?.settings?.optionLayout) ? quiz.settings.optionLayout : "auto",
  },
  access: {
    type: quiz?.access?.type || "free",
    price: typeof quiz?.access?.price === "number" ? quiz.access.price : undefined,
    allowedGroupIds: Array.isArray(quiz?.access?.allowedGroupIds) ? quiz.access.allowedGroupIds.map(String) : [],
  },
  questionIds: Array.isArray(quiz?.questionIds) ? quiz.questionIds.map(String) : [],
  createdAt: toTimestamp(quiz?.createdAt),
  isPublished: Boolean(quiz?.isPublished),
  showOnPlatform: quiz?.showOnPlatform !== false,
  skillIds: Array.isArray(quiz?.skillIds) ? quiz.skillIds.map(String) : [],
  targetGroupIds: Array.isArray(quiz?.targetGroupIds) ? quiz.targetGroupIds.map(String) : [],
  targetUserIds: Array.isArray(quiz?.targetUserIds) ? quiz.targetUserIds.map(String) : [],
  dueDate: quiz?.dueDate || undefined,
  ownerType: quiz?.ownerType,
  ownerId: quiz?.ownerId || undefined,
  createdBy: quiz?.createdBy || undefined,
  assignedTeacherId: quiz?.assignedTeacherId || undefined,
  approvalStatus: quiz?.approvalStatus,
  approvedBy: quiz?.approvedBy || undefined,
  approvedAt: typeof quiz?.approvedAt === "number" ? quiz.approvedAt : undefined,
  reviewerNotes: quiz?.reviewerNotes || undefined,
  revenueSharePercentage: typeof quiz?.revenueSharePercentage === "number" ? quiz.revenueSharePercentage : undefined,
});

export const adapter = {
  async getCourses() {
    if (!USE_REAL_API) {
      return [];
    }

    try {
      const data = await api.getCourses();
      const normalized = Array.isArray(data) ? data.map(normalizeCourse).filter((course) => course.id) : [];
      return normalized;
    } catch (error) {
      console.warn("Falling back to empty courses:", error);
      return [];
    }
  },

  async getCourseById(courseId: string) {
    if (!USE_REAL_API) {
      return null;
    }

    try {
      const data = await api.getCourseById(courseId);
      if (data) {
        const normalized = normalizeCourse(data);
        if (normalized.id) {
          return normalized;
        }
      }
    } catch (error) {
      console.warn(`Unable to fetch course for ${courseId}:`, error);
    }

    return null;
  },

  async getTaxonomyBootstrap(phase: "full" | "core" = "full") {
    if (!USE_REAL_API) {
      return {
        paths: [],
        levels: [],
        subjects: [],
        sections: [],
        skills: [],
      };
    }

    try {
      const data = await api.getTaxonomyBootstrap(phase);

      return {
        paths: Array.isArray(data?.paths) ? data.paths.map(normalizePath).filter((path) => path.id && path.name) : [],
        levels: Array.isArray(data?.levels) ? data.levels.map(normalizeLevel).filter((level) => level.id && level.pathId) : [],
        subjects: Array.isArray(data?.subjects)
          ? data.subjects.map(normalizeSubject).filter((subject) => subject.id && subject.pathId && subject.name)
          : [],
        sections: Array.isArray(data?.sections)
          ? data.sections.map(normalizeSection).filter((section) => section.id && section.subjectId && section.name)
          : [],
        skills: Array.isArray(data?.skills)
          ? data.skills.map(normalizeSkill).filter((skill) => skill.id && skill.pathId && skill.subjectId && skill.sectionId && skill.name)
          : [],
      };
    } catch (error) {
      console.warn("Falling back to empty taxonomy bootstrap:", error);
      return {
        paths: [],
        levels: [],
        subjects: [],
        sections: [],
        skills: [],
      };
    }
  },

  async getContentBootstrap(scope: "full" | "learning" = "full", phase: "full" | "core" = "full") {
    if (!USE_REAL_API) {
      return {
        topics: [],
        lessons: [],
        libraryItems: [],
        groups: [],
        b2bPackages: [],
        accessCodes: [],
        announcementAds: [],
        studyPlans: [],
      };
    }

    try {
      const data = await api.getContentBootstrapByScope(scope, phase);
      return {
        topics: Array.isArray(data?.topics) ? data.topics.map(normalizeTopic).filter((topic) => topic.id && topic.subjectId && topic.title) : [],
        lessons: Array.isArray(data?.lessons) ? data.lessons.map((lesson: any, index: number) => normalizeLesson(lesson, 0, index)).filter((lesson) => lesson.id && lesson.title) : [],
        libraryItems: Array.isArray(data?.libraryItems) ? data.libraryItems.map(normalizeLibraryItem).filter((item) => item.id && item.title) : [],
        groups: Array.isArray(data?.groups) ? data.groups.map(normalizeGroup).filter((group) => group.id && group.name) : [],
        b2bPackages: Array.isArray(data?.b2bPackages) ? data.b2bPackages.map(normalizeB2BPackage).filter((pkg) => pkg.id && pkg.schoolId && pkg.name) : [],
        accessCodes: Array.isArray(data?.accessCodes) ? data.accessCodes.map(normalizeAccessCode).filter((code) => code.id && code.schoolId && code.packageId && code.code) : [],
        announcementAds: Array.isArray(data?.announcementAds) ? data.announcementAds.map(normalizeAnnouncementAd).filter((ad) => ad.id && ad.title) : [],
        studyPlans: Array.isArray(data?.studyPlans) ? data.studyPlans.map(normalizeStudyPlan).filter((plan) => plan.id && plan.userId && plan.name && plan.pathId) : [],
      };
    } catch (error) {
      console.warn("Falling back to empty content bootstrap:", error);
      return {
        topics: [],
        lessons: [],
        libraryItems: [],
        groups: [],
        b2bPackages: [],
        accessCodes: [],
        announcementAds: [],
        studyPlans: [],
      };
    }
  },

  async getQuestions(params?: { page?: number; limit?: number; ids?: string; pathId?: string; subject?: string; sectionId?: string; skillId?: string; search?: string; approvalStatus?: string; summary?: boolean; noTotal?: boolean }): Promise<Question[]> {
    if (!USE_REAL_API) {
      return [];
    }

    try {
      const data = await api.getQuestions(params || { page: 1, limit: 20, summary: true, noTotal: true });
      return Array.isArray(data) ? data.map(normalizeQuestion).filter((question) => question.id && question.text) : [];
    } catch (error) {
      console.warn("Falling back to existing in-memory questions:", error);
      return [];
    }
  },

  async getQuizzes(): Promise<Quiz[]> {
    if (!USE_REAL_API) {
      return [];
    }

    try {
      const data = await api.getQuizzes();
      return Array.isArray(data) ? data.map(normalizeQuiz).filter((quiz) => quiz.id && quiz.title) : [];
    } catch (error) {
      console.warn("Falling back to existing in-memory quizzes:", error);
      return [];
    }
  },
};

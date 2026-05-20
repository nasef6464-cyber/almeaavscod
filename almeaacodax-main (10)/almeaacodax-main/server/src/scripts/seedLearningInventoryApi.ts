const API_BASE = process.env.SEED_API_BASE_URL || "https://almeaacodax-k2ux.onrender.com/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "nasef64@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Nn@0120110367";
const SAMPLE_VIDEO_URL = process.env.SEED_SAMPLE_VIDEO_URL || "https://www.youtube.com/watch?v=2BoPkKAm6uc";
const SAMPLE_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type AuthSession = {
  token: string;
  user: any;
};

type TargetSubject = {
  pathId: string;
  subjectId: string;
  subjectName: string;
  slug: string;
  topicTitle: string;
  subTopicTitle: string;
  lessonTitle: string;
  libraryTitle: string;
  courseTitle: string;
  bankTitle: string;
  examTitle: string;
  questionStem: string;
};

async function request<T>(path: string, method: HttpMethod = "GET", body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function login(email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", "POST", { email, password });
}

function documentId(item: any) {
  return String(item?.id || item?._id || "");
}

function normalizeArabic(value: unknown) {
  return String(value || "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function byId(items: any[] = []) {
  const entries: Array<[string, any]> = [];
  items.forEach((item) => {
    const id = documentId(item);
    if (id) {
      entries.push([id, item]);
    }
  });
  return new Map(entries);
}

async function fetchSnapshots(token: string) {
  const [taxonomy, content, questions, quizzes, courses] = await Promise.all([
    request<any>("/taxonomy/bootstrap", "GET", undefined, token),
    request<any>("/content/bootstrap", "GET", undefined, token),
    request<any[]>("/quizzes/questions", "GET", undefined, token),
    request<any[]>("/quizzes", "GET", undefined, token),
    request<any[]>("/courses", "GET", undefined, token),
  ]);

  return { taxonomy, content, questions, quizzes, courses };
}

function pickSubject(subjects: any[], pathId: string, names: string[]) {
  const normalizedNames = names.map(normalizeArabic);
  return subjects.find((subject) => {
    const subjectId = documentId(subject);
    if (!subjectId || subject.pathId !== pathId) return false;
    const normalizedName = normalizeArabic(subject.name);
    return normalizedNames.some((name) => normalizedName.includes(name));
  });
}

function buildTargets(subjects: any[]): TargetSubject[] {
  const targets: TargetSubject[] = [];
  const quant = pickSubject(subjects, "p_qudrat", ["الكمي", "كمي"]);
  const verbal = pickSubject(subjects, "p_qudrat", ["اللفظي", "لفظي"]);
  const tahsiliMath = pickSubject(subjects, "p_tahsili", ["رياضيات", "الرياضيات"]);

  if (quant) {
    targets.push({
      pathId: "p_qudrat",
      subjectId: documentId(quant),
      subjectName: quant.name || "الكمي",
      slug: "qudrat_quant",
      topicTitle: "أساسيات الكمي",
      subTopicTitle: "ترتيب العمليات والكسور",
      lessonTitle: "شرح ترتيب العمليات والكسور",
      libraryTitle: "ملخص الكمي: العمليات والكسور",
      courseTitle: "دورة تأسيس الكمي التجريبية",
      bankTitle: "تدريب الكمي: العمليات والكسور",
      examTitle: "اختبار محاكي الكمي القصير",
      questionStem: "إذا كان 3/4 عدد يساوي 24، فما العدد؟",
    });
  }

  if (verbal) {
    targets.push({
      pathId: "p_qudrat",
      subjectId: documentId(verbal),
      subjectName: verbal.name || "اللفظي",
      slug: "qudrat_verbal",
      topicTitle: "أساسيات اللفظي",
      subTopicTitle: "فهم السياق والمعنى",
      lessonTitle: "شرح فهم السياق في النص",
      libraryTitle: "ملخص اللفظي: فهم السياق",
      courseTitle: "دورة تأسيس اللفظي التجريبية",
      bankTitle: "تدريب اللفظي: فهم السياق",
      examTitle: "اختبار محاكي اللفظي القصير",
      questionStem: "أي الكلمات أقرب معنى لكلمة: استنتاج؟",
    });
  }

  if (tahsiliMath) {
    targets.push({
      pathId: "p_tahsili",
      subjectId: documentId(tahsiliMath),
      subjectName: tahsiliMath.name || "رياضيات",
      slug: "tahsili_math",
      topicTitle: "أساسيات التحصيلي رياضيات",
      subTopicTitle: "الدوال والتمثيل البياني",
      lessonTitle: "شرح قراءة الدوال من الرسم",
      libraryTitle: "ورقة مراجعة الدوال",
      courseTitle: "دورة التحصيلي رياضيات التجريبية",
      bankTitle: "تدريب التحصيلي: الدوال",
      examTitle: "اختبار محاكي رياضيات قصير",
      questionStem: "إذا كانت ص = 2س + 1، فما قيمة ص عندما س = 3؟",
    });
  }

  return targets;
}

async function upsert(token: string, collection: keyof Awaited<ReturnType<typeof fetchSnapshots>>, id: string, postPath: string, patchPath: string, payload: any) {
  const snapshots = await fetchSnapshots(token);
  const source =
    collection === "taxonomy"
      ? [
          ...(snapshots.taxonomy.paths || []),
          ...(snapshots.taxonomy.levels || []),
          ...(snapshots.taxonomy.subjects || []),
          ...(snapshots.taxonomy.sections || []),
          ...(snapshots.taxonomy.skills || []),
        ]
      : collection === "content"
        ? [...(snapshots.content.topics || []), ...(snapshots.content.lessons || []), ...(snapshots.content.libraryItems || [])]
        : (snapshots[collection] as any[]);
  const exists = byId(source).has(id);
  return request<any>(exists ? patchPath : postPath, exists ? "PATCH" : "POST", payload, token);
}

async function upsertLearningTarget(token: string, target: TargetSubject) {
  const sectionId = `sec_learning_${target.slug}`;
  const skillId = `skill_learning_${target.slug}_core`;
  const lessonId = `lesson_learning_${target.slug}_intro`;
  const questionOneId = `q_learning_${target.slug}_01`;
  const questionTwoId = `q_learning_${target.slug}_02`;
  const bankId = `quiz_learning_${target.slug}_bank`;
  const lockedBankId = `quiz_learning_${target.slug}_bank_locked`;
  const examId = `quiz_learning_${target.slug}_exam`;
  const lockedExamId = `quiz_learning_${target.slug}_exam_locked`;
  const libraryId = `lib_learning_${target.slug}_summary`;
  const lockedLibraryId = `lib_learning_${target.slug}_locked`;
  const courseId = `course_learning_${target.slug}_intro`;
  const premiumCourseId = `course_learning_${target.slug}_premium`;
  const foundationPackageId = `pkg_public_${target.slug}_foundation`;
  const testsPackageId = `pkg_public_${target.slug}_tests`;
  const subjectPackageId = `pkg_public_${target.slug}_complete`;
  const pathPackageId = `pkg_public_${target.pathId}_complete`;
  const mainTopicId = `topic_learning_${target.slug}_main`;
  const subTopicId = `topic_learning_${target.slug}_sub`;
  const lockedTopicId = `topic_learning_${target.slug}_locked`;

  await upsert(token, "taxonomy", sectionId, "/taxonomy/sections", `/taxonomy/sections/${sectionId}`, {
    id: sectionId,
    subjectId: target.subjectId,
    name: target.topicTitle,
  });

  await upsert(token, "taxonomy", skillId, "/taxonomy/skills", `/taxonomy/skills/${skillId}`, {
    id: skillId,
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    name: target.subTopicTitle,
    description: `مهارة تشغيلية مرتبطة بمادة ${target.subjectName} لاختبار الربط والتحليل.`,
    lessonIds: [lessonId],
    questionIds: [questionOneId, questionTwoId],
  });

  await upsert(token, "content", lessonId, "/content/lessons", `/content/lessons/${lessonId}`, {
    id: lessonId,
    title: target.lessonTitle,
    description: `درس تجريبي معتمد داخل مساحة تعلم ${target.subjectName}.`,
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    type: "video",
    duration: "15 دقيقة",
    content: "",
    videoUrl: SAMPLE_VIDEO_URL,
    videoSource: "upload",
    fileUrl: "",
    quizId: null,
    order: 1,
    isLocked: false,
    showOnPlatform: true,
    accessControl: "public",
    skillIds: [skillId],
    approvalStatus: "approved",
  });

  const questionBase = {
    pathId: target.pathId,
    subject: target.subjectId,
    sectionId,
    videoUrl: SAMPLE_VIDEO_URL,
    skillIds: [skillId],
    difficulty: "Easy",
    type: "mcq",
    approvalStatus: "approved",
  };

  await upsert(token, "questions", questionOneId, "/quizzes/questions", `/quizzes/questions/${questionOneId}`, {
    ...questionBase,
    id: questionOneId,
    text: target.questionStem,
    options: target.slug.includes("verbal") ? ["استخراج معنى", "حذف النص", "تغيير العنوان", "نسخ الجملة"] : ["24", "30", "32", "36"],
    correctOptionIndex: target.slug.includes("verbal") ? 0 : 2,
    explanation: "هذا سؤال تشغيلي مرتبط بالمهارة حتى يظهر أثره في التحليل والتوصيات.",
  });

  await upsert(token, "questions", questionTwoId, "/quizzes/questions", `/quizzes/questions/${questionTwoId}`, {
    ...questionBase,
    id: questionTwoId,
    text: target.slug.includes("verbal") ? "ما الفكرة الرئيسة من فقرة قصيرة تتحدث عن تنظيم الوقت؟" : "ما الخطوة الأولى الصحيحة عند حل المسألة؟",
    options: ["فهم المطلوب", "تجاهل المعطيات", "اختيار عشوائي", "ترك السؤال"],
    correctOptionIndex: 0,
    explanation: "نبدأ دائمًا بفهم المطلوب وربطه بالمهارة المناسبة.",
  });

  const quizBase = {
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    settings: { durationInMinutes: 12, questionCount: 2, showResultsImmediately: true },
    access: { type: "free" },
    questionIds: [questionOneId, questionTwoId],
    skillIds: [skillId],
    targetGroupIds: [],
    targetUserIds: [],
    dueDate: null,
    isPublished: true,
    showOnPlatform: true,
    approvalStatus: "approved",
  };

  await upsert(token, "quizzes", bankId, "/quizzes", `/quizzes/${bankId}`, {
    ...quizBase,
    id: bankId,
    title: target.bankTitle,
    description: `تدريب قصير على ${target.subTopicTitle}.`,
    type: "bank",
    mode: "regular",
  });

  await upsert(token, "quizzes", lockedBankId, "/quizzes", `/quizzes/${lockedBankId}`, {
    ...quizBase,
    id: lockedBankId,
    title: `${target.bankTitle} - متقدم`,
    description: `تدريب مدفوع للتأكد من ظهور القفل وربطه بباقة ${target.subjectName}.`,
    type: "bank",
    mode: "regular",
    access: { type: "paid", price: 19 },
  });

  await upsert(token, "quizzes", examId, "/quizzes", `/quizzes/${examId}`, {
    ...quizBase,
    id: examId,
    title: target.examTitle,
    description: `اختبار محاكي سريع داخل ${target.subjectName}.`,
    type: "quiz",
    mode: "regular",
  });

  await upsert(token, "quizzes", lockedExamId, "/quizzes", `/quizzes/${lockedExamId}`, {
    ...quizBase,
    id: lockedExamId,
    title: `${target.examTitle} - شامل`,
    description: `اختبار محاكي مدفوع للتأكد من رحلة الطالب مع الباقات.`,
    type: "quiz",
    mode: "regular",
    access: { type: "paid", price: 29 },
  });

  await upsert(token, "content", libraryId, "/content/library-items", `/content/library-items/${libraryId}`, {
    id: libraryId,
    title: target.libraryTitle,
    size: "1.2 MB",
    downloads: 0,
    type: "pdf",
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    skillIds: [skillId],
    url: SAMPLE_PDF_URL,
    showOnPlatform: true,
    isLocked: false,
    approvalStatus: "approved",
  });

  await upsert(token, "content", lockedLibraryId, "/content/library-items", `/content/library-items/${lockedLibraryId}`, {
    id: lockedLibraryId,
    title: `${target.libraryTitle} - ملف شامل`,
    size: "2.4 MB",
    downloads: 0,
    type: "pdf",
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    skillIds: [skillId],
    url: SAMPLE_PDF_URL,
    showOnPlatform: true,
    isLocked: true,
    approvalStatus: "approved",
  });

  await upsert(token, "courses", courseId, "/courses", `/courses/${courseId}`, {
    id: courseId,
    title: target.courseTitle,
    thumbnail: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
    instructor: "فريق منصة المئة",
    price: 0,
    currency: "SAR",
    duration: 45,
    level: "Beginner",
    rating: 4.8,
    progress: 0,
    category: target.pathId,
    subject: target.subjectId,
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    features: ["شرح فيديو", "تدريب قصير", "اختبار محاكي", "ملف مراجعة"],
    description: `دورة تشغيلية خفيفة للتأكد من أن مساحة تعلم ${target.subjectName} تعرض كل البنود.`,
    modules: [
      {
        id: `module_${target.slug}_01`,
        title: target.topicTitle,
        lessons: [{ id: lessonId, title: target.lessonTitle, type: "video", duration: "15 دقيقة", videoUrl: SAMPLE_VIDEO_URL }],
      },
    ],
    isPublished: true,
    showOnPlatform: true,
    isPackage: false,
    skills: [skillId],
    approvalStatus: "approved",
    certificateEnabled: false,
  });

  await upsert(token, "courses", premiumCourseId, "/courses", `/courses/${premiumCourseId}`, {
    id: premiumCourseId,
    title: `${target.courseTitle} - متقدم`,
    thumbnail: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=80",
    instructor: "فريق منصة المئة",
    price: 79,
    currency: "SAR",
    duration: 120,
    level: "Intermediate",
    rating: 4.9,
    progress: 0,
    category: target.pathId,
    subject: target.subjectId,
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    features: ["شرح متقدم", "اختبارات محاكية", "ملفات علاجية", "تقرير مهاري"],
    description: `دورة مغلقة لتجربة الشراء والباقات داخل ${target.subjectName}.`,
    modules: [
      {
        id: `module_${target.slug}_premium_01`,
        title: `${target.topicTitle} المتقدم`,
        lessons: [{ id: lessonId, title: target.lessonTitle, type: "video", duration: "15 دقيقة", videoUrl: SAMPLE_VIDEO_URL }],
      },
    ],
    isPublished: true,
    showOnPlatform: true,
    isPackage: false,
    originalPrice: 119,
    skills: [skillId],
    approvalStatus: "approved",
    certificateEnabled: true,
  });

  const publicPackages = [
    {
      id: foundationPackageId,
      title: `باقة التأسيس - ${target.subjectName}`,
      price: 39,
      originalPrice: 59,
      packageContentTypes: ["foundation"],
      features: ["فتح الموضوعات المغلقة", "دروس فيديو", "تدريبات قصيرة"],
      includedCourses: [courseId, premiumCourseId],
    },
    {
      id: testsPackageId,
      title: `باقة الاختبارات - ${target.subjectName}`,
      price: 49,
      originalPrice: 79,
      packageContentTypes: ["banks", "tests"],
      features: ["تدريبات مغلقة", "اختبارات محاكية", "تحليل مهاري"],
      includedCourses: [],
    },
    {
      id: subjectPackageId,
      title: `باقة ${target.subjectName} كاملة`,
      price: 99,
      originalPrice: 149,
      packageContentTypes: ["all"],
      features: ["الدورات", "التأسيس", "التدريب", "الاختبارات", "المكتبة"],
      includedCourses: [courseId, premiumCourseId],
    },
    {
      id: pathPackageId,
      title: `باقة المسار كاملة - ${target.pathId === "p_qudrat" ? "القدرات" : "التحصيلي"}`,
      price: target.pathId === "p_qudrat" ? 179 : 129,
      originalPrice: target.pathId === "p_qudrat" ? 249 : 189,
      packageContentTypes: ["all"],
      features: ["كل مواد المسار", "اختبارات شاملة", "مكتبة علاجية"],
      includedCourses: [courseId, premiumCourseId],
      subjectId: "",
    },
  ];

  for (const publicPackage of publicPackages) {
    await upsert(token, "courses", publicPackage.id, "/courses", `/courses/${publicPackage.id}`, {
      id: publicPackage.id,
      title: publicPackage.title,
      thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
      instructor: "منصة المئة",
      price: publicPackage.price,
      currency: "SAR",
      duration: 0,
      level: "Beginner",
      rating: 4.9,
      progress: 0,
      category: target.pathId,
      subject: publicPackage.subjectId === "" ? "" : target.subjectId,
      pathId: target.pathId,
      subjectId: publicPackage.subjectId === "" ? "" : target.subjectId,
      sectionId,
      features: publicPackage.features,
      description: `باقة عامة ظاهرة للطالب ويمكن إدارتها من إدارة الباقات والعروض.`,
      modules: [],
      isPublished: true,
      showOnPlatform: true,
      isPackage: true,
      packageType: "courses",
      packageContentTypes: publicPackage.packageContentTypes,
      originalPrice: publicPackage.originalPrice,
      includedCourses: publicPackage.includedCourses,
      skills: [skillId],
      approvalStatus: "approved",
      certificateEnabled: false,
    });
  }

  await upsert(token, "content", mainTopicId, "/content/topics", `/content/topics/${mainTopicId}`, {
    id: mainTopicId,
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    title: target.topicTitle,
    parentId: null,
    order: 1,
    showOnPlatform: true,
    isLocked: false,
    lessonIds: [lessonId],
    quizIds: [bankId],
  });

  await upsert(token, "content", subTopicId, "/content/topics", `/content/topics/${subTopicId}`, {
    id: subTopicId,
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    title: target.subTopicTitle,
    parentId: mainTopicId,
    order: 2,
    showOnPlatform: true,
    isLocked: false,
    lessonIds: [lessonId],
    quizIds: [bankId, examId],
  });

  await upsert(token, "content", lockedTopicId, "/content/topics", `/content/topics/${lockedTopicId}`, {
    id: lockedTopicId,
    pathId: target.pathId,
    subjectId: target.subjectId,
    sectionId,
    title: `${target.subTopicTitle} - متقدم`,
    parentId: mainTopicId,
    order: 3,
    showOnPlatform: true,
    isLocked: true,
    lessonIds: [lessonId],
    quizIds: [lockedBankId, lockedExamId],
  });

  return { subject: target.subjectName, subjectId: target.subjectId, courseId, premiumCourseId, topicId: mainTopicId, lessonId, bankId, lockedBankId, examId, lockedExamId, libraryId, lockedLibraryId };
}

async function verifyLearningInventory(token: string, targets: TargetSubject[]) {
  const snapshots = await fetchSnapshots(token);
  return targets.map((target) => {
    const topics = (snapshots.content.topics || []).filter((item: any) => item.pathId === target.pathId && item.subjectId === target.subjectId);
    const lessons = (snapshots.content.lessons || []).filter((item: any) => item.pathId === target.pathId && item.subjectId === target.subjectId);
    const library = (snapshots.content.libraryItems || []).filter((item: any) => item.pathId === target.pathId && item.subjectId === target.subjectId);
    const quizzes = (snapshots.quizzes || []).filter((item: any) => item.pathId === target.pathId && item.subjectId === target.subjectId);
    const courses = (snapshots.courses || []).filter((item: any) => (item.pathId || item.category) === target.pathId && (item.subjectId || item.subject) === target.subjectId);

    return {
      pathId: target.pathId,
      subjectId: target.subjectId,
      subject: target.subjectName,
      topics: topics.length,
      lessons: lessons.length,
      banks: quizzes.filter((item: any) => item.type === "bank").length,
      exams: quizzes.filter((item: any) => item.type !== "bank").length,
      library: library.length,
      courses: courses.length,
      ready: topics.length > 0 && lessons.length > 0 && quizzes.length > 0 && library.length > 0 && courses.length > 0,
    };
  });
}

async function main() {
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const snapshots = await fetchSnapshots(admin.token);
  const targets = buildTargets(snapshots.taxonomy.subjects || []);

  if (targets.length === 0) {
    throw new Error("No matching visible subjects were found for learning inventory seeding.");
  }

  const upserted = [];
  for (const target of targets) {
    upserted.push(await upsertLearningTarget(admin.token, target));
  }

  const verification = await verifyLearningInventory(admin.token, targets);
  const failed = verification.filter((item) => !item.ready);

  console.log("Learning inventory seeded successfully");
  console.log(JSON.stringify({ upserted, verification }, null, 2));

  if (failed.length > 0) {
    throw new Error(`Learning inventory verification failed for ${failed.map((item) => item.subject).join(", ")}`);
  }
}

main().catch((error) => {
  console.error("Failed to seed learning inventory");
  console.error(error);
  process.exit(1);
});

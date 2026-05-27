const API_BASE = process.env.SEED_API_BASE_URL || "https://almeaavscod.onrender.com/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "nasef64@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Nn@0120110367";
const SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const SAMPLE_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type AuthSession = {
  token: string;
  user: any;
};

type SeedUser = {
  key: string;
  name: string;
  email: string;
  password: string;
  role: "teacher" | "student" | "supervisor" | "parent";
  managedPathIds?: string[];
  managedSubjectIds?: string[];
};

const pathSeeds = [
  {
    id: "p_qudrat",
    name: "مسار القدرات",
    color: "purple",
    icon: "🧠",
    showInNavbar: true,
    showInHome: true,
    isActive: true,
    description: "مسار القدرات العامة بفرعيه الكمي واللفظي.",
  },
  {
    id: "p_tahsili",
    name: "مسار التحصيلي",
    color: "blue",
    icon: "🎓",
    showInNavbar: true,
    showInHome: true,
    isActive: true,
    description: "مسار التحصيلي العلمي والمواد المرتبطة به.",
  },
];

const levelSeeds = [
  { id: "lvl_qudrat_general", pathId: "p_qudrat", name: "عام" },
  { id: "lvl_tahsili_scientific", pathId: "p_tahsili", name: "علمي" },
];

const subjectSeeds = [
  { id: "sub_quant", pathId: "p_qudrat", levelId: "lvl_qudrat_general", name: "الكمي", color: "purple", icon: "📘" },
  { id: "sub_verbal", pathId: "p_qudrat", levelId: "lvl_qudrat_general", name: "اللفظي", color: "amber", icon: "📚" },
  { id: "sub_math", pathId: "p_tahsili", levelId: "lvl_tahsili_scientific", name: "الرياضيات", color: "blue", icon: "📐" },
];

const sectionSeeds = [
  { id: "sec_quant_ops", subjectId: "sub_quant", name: "العمليات الحسابية" },
  { id: "sec_quant_alg", subjectId: "sub_quant", name: "الجبر والمعادلات" },
  { id: "sec_verbal_context", subjectId: "sub_verbal", name: "الاستيعاب اللفظي" },
  { id: "sec_math_functions", subjectId: "sub_math", name: "الدوال والتمثيل البياني" },
];

const skillSeeds = [
  {
    id: "skill_quant_add_sub",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_ops",
    name: "الجمع والطرح السريع",
    description: "إتقان العمليات الأساسية في مسائل القدرات الكمي.",
  },
  {
    id: "skill_quant_fractions",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_ops",
    name: "الكسور والنسب",
    description: "تحويل الكسور والنسب المئوية وحل مسائل المقارنة.",
  },
  {
    id: "skill_quant_equations",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_alg",
    name: "حل المعادلات",
    description: "تحليل المعادلات الخطية والتعامل مع المجهول بمرونة.",
  },
  {
    id: "skill_quant_proportions",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_alg",
    name: "التناسب والطردي والعكسي",
    description: "فهم العلاقات التناسبية وتطبيقها على أسئلة القدرات.",
  },
  {
    id: "skill_verbal_context",
    pathId: "p_qudrat",
    subjectId: "sub_verbal",
    sectionId: "sec_verbal_context",
    name: "فهم السياق",
    description: "تحديد معنى النص واستنتاج الفكرة الرئيسة.",
  },
  {
    id: "skill_math_functions",
    pathId: "p_tahsili",
    subjectId: "sub_math",
    sectionId: "sec_math_functions",
    name: "تحليل الدوال",
    description: "قراءة الدوال والتمثيل البياني وربطها بالمعادلات.",
  },
];

const seedUsers: SeedUser[] = [
  {
    key: "teacherQuant",
    name: "أ. ريم الكمي",
    email: "teacher.quant@almeaa.local",
    password: "Teacher@123",
    role: "teacher",
    managedPathIds: ["p_qudrat"],
    managedSubjectIds: ["sub_quant"],
  },
  {
    key: "teacherMath",
    name: "أ. خالد الرياضيات",
    email: "teacher.math@almeaa.local",
    password: "Teacher@123",
    role: "teacher",
    managedPathIds: ["p_tahsili"],
    managedSubjectIds: ["sub_math"],
  },
  {
    key: "schoolSupervisor",
    name: "أ. نورة مشرفة المدرسة",
    email: "supervisor.school@almeaa.local",
    password: "Supervisor@123",
    role: "supervisor",
  },
  {
    key: "groupSupervisor",
    name: "أ. فهد مشرف المجموعة",
    email: "supervisor.group@almeaa.local",
    password: "Supervisor@123",
    role: "supervisor",
  },
  {
    key: "studentA",
    name: "سلمان أحمد",
    email: "student.a@almeaa.local",
    password: "Student@123",
    role: "student",
  },
  {
    key: "studentB",
    name: "ليان محمد",
    email: "student.b@almeaa.local",
    password: "Student@123",
    role: "student",
  },
  {
    key: "studentC",
    name: "مشعل عبدالعزيز",
    email: "student.c@almeaa.local",
    password: "Student@123",
    role: "student",
  },
  {
    key: "studentD",
    name: "جود خالد",
    email: "student.d@almeaa.local",
    password: "Student@123",
    role: "student",
  },
  {
    key: "parentA",
    name: "أم سلمان",
    email: "parent.a@almeaa.local",
    password: "Parent@123",
    role: "parent",
  },
  {
    key: "parentB",
    name: "ولي أمر ليان",
    email: "parent.b@almeaa.local",
    password: "Parent@123",
    role: "parent",
  },
];

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

function byIdOrMongoId(items: any[]) {
  const map = new Map<string, any>();
  items.forEach((item) => {
    if (item?.id) map.set(String(item.id), item);
    if (item?._id) map.set(String(item._id), item);
  });
  return map;
}

function findLessonBySignature(lessons: any[], title: string, pathId: string, subjectId: string) {
  return lessons.find(
    (lesson) =>
      String(lesson.title || "").trim() === title &&
      String(lesson.pathId || "") === pathId &&
      String(lesson.subjectId || "") === subjectId,
  );
}

function normalizeArabicLabel(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/^ال/, "")
    .toLowerCase();
}

function findSubjectsByPathAndNames(subjects: any[], pathId: string, names: string[]) {
  const acceptedNames = names.map(normalizeArabicLabel);
  return subjects.filter((subject) => {
    const subjectName = normalizeArabicLabel(subject?.name);
    return String(subject?.pathId || "") === pathId && acceptedNames.some((name) => subjectName.includes(name) || name.includes(subjectName));
  });
}

function findGroupByName(groups: any[], name: string, type: string) {
  return groups.find((group) => String(group.name || "").trim() === name && String(group.type || "") === type);
}

async function fetchSnapshots(token: string) {
  const [taxonomy, content, usersData, questions, quizzes, courses] = await Promise.all([
    request<any>("/taxonomy/bootstrap", "GET", undefined, token),
    request<any>("/content/bootstrap", "GET", undefined, token),
    request<any>("/auth/admin/users", "GET", undefined, token),
    request<any[]>("/quizzes/questions", "GET", undefined, token),
    request<any[]>("/quizzes", "GET", undefined, token),
    request<any[]>("/courses", "GET", undefined, token),
  ]);

  return {
    taxonomy,
    content,
    users: usersData.users || [],
    questions,
    quizzes,
    courses,
  };
}

async function upsertTaxonomy(token: string, snapshots: Awaited<ReturnType<typeof fetchSnapshots>>) {
  const pathsById = byIdOrMongoId(snapshots.taxonomy.paths || []);
  const levelsById = byIdOrMongoId(snapshots.taxonomy.levels || []);
  const subjectsById = byIdOrMongoId(snapshots.taxonomy.subjects || []);
  const sectionsById = byIdOrMongoId(snapshots.taxonomy.sections || []);
  const skillsById = byIdOrMongoId(snapshots.taxonomy.skills || []);

  for (const path of pathSeeds) {
    if (pathsById.has(path.id)) {
      await request(`/taxonomy/paths/${path.id}`, "PATCH", path, token);
    } else {
      await request("/taxonomy/paths", "POST", path, token);
    }
  }

  for (const level of levelSeeds) {
    if (levelsById.has(level.id)) {
      await request(`/taxonomy/levels/${level.id}`, "PATCH", level, token);
    } else {
      await request("/taxonomy/levels", "POST", level, token);
    }
  }

  for (const subject of subjectSeeds) {
    if (subjectsById.has(subject.id)) {
      await request(`/taxonomy/subjects/${subject.id}`, "PATCH", subject, token);
    } else {
      await request("/taxonomy/subjects", "POST", subject, token);
    }
  }

  for (const section of sectionSeeds) {
    if (sectionsById.has(section.id)) {
      await request(`/taxonomy/sections/${section.id}`, "PATCH", section, token);
    } else {
      await request("/taxonomy/sections", "POST", section, token);
    }
  }

  for (const skill of skillSeeds) {
    if (skillsById.has(skill.id)) {
      await request(`/taxonomy/skills/${skill.id}`, "PATCH", skill, token);
    } else {
      await request("/taxonomy/skills", "POST", skill, token);
    }
  }
}

async function upsertUsers(token: string) {
  const currentUsers = await request<any>("/auth/admin/users", "GET", undefined, token);
  const usersByEmail = new Map<string, any>(
    (currentUsers.users || []).map((user: any) => [String(user.email).toLowerCase(), user]),
  );

  for (const user of seedUsers) {
    const payload = {
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
      managedPathIds: user.managedPathIds || [],
      managedSubjectIds: user.managedSubjectIds || [],
      linkedStudentIds: [],
    };

    if (usersByEmail.has(user.email.toLowerCase())) {
      const existing: any = usersByEmail.get(user.email.toLowerCase());
      await request(`/auth/admin/users/${existing._id || existing.id}`, "PATCH", {
        name: user.name,
        role: user.role,
        managedPathIds: user.managedPathIds || [],
        managedSubjectIds: user.managedSubjectIds || [],
      }, token);
    } else {
      await request("/auth/admin/users", "POST", payload, token);
    }
  }

  const refreshed = await request<any>("/auth/admin/users", "GET", undefined, token);
  return new Map<string, any>((refreshed.users || []).map((user: any) => [String(user.email).toLowerCase(), user]));
}

async function upsertLessonsQuestionsEtc(
  adminToken: string,
  teacherQuantToken: string,
  teacherMathToken: string,
  usersByEmail: Map<string, any>,
) {
  let snapshots = await fetchSnapshots(adminToken);

  const adminId = String(usersByEmail.get(ADMIN_EMAIL.toLowerCase())?._id || usersByEmail.get(ADMIN_EMAIL.toLowerCase())?.id || "");
  const teacherQuant = usersByEmail.get("teacher.quant@almeaa.local");
  const teacherMath = usersByEmail.get("teacher.math@almeaa.local");

  const ensureLesson = async (payload: any, token: string) => {
    snapshots = await fetchSnapshots(adminToken);
    const existing = findLessonBySignature(snapshots.content.lessons || [], payload.title, payload.pathId, payload.subjectId);
    if (existing) {
      return request<any>(`/content/lessons/${existing._id || existing.id}`, "PATCH", payload, token);
    }
    return request<any>("/content/lessons", "POST", payload, token);
  };

  const lessonOps = await ensureLesson(
    {
      title: "ترتيب العمليات الأساسية",
      description: "شرح تأسيسي مرتب لخطوات ترتيب العمليات الحسابية.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      type: "video",
      duration: "18 دقيقة",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_add_sub"],
      approvalStatus: "approved",
    },
    adminToken,
  );

  const lessonFractions = await ensureLesson(
    {
      title: "الكسور والنسب بطريقة سهلة",
      description: "درس تأسيسي على تبسيط الكسور وتحويل النسب المئوية.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      type: "video",
      duration: "22 دقيقة",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_fractions"],
      approvalStatus: "approved",
    },
    adminToken,
  );

  const lessonEquations = await ensureLesson(
    {
      title: "بناء المعادلة من المسألة",
      description: "تحويل المسألة اللفظية إلى معادلة ثم حلها.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_alg",
      type: "video",
      duration: "16 دقيقة",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_equations", "skill_quant_proportions"],
      approvalStatus: "approved",
    },
    adminToken,
  );

  const lessonMath = await ensureLesson(
    {
      title: "قراءة الدوال من التمثيل البياني",
      description: "درس تحصيلي على تحليل الدوال والتمثيل البياني.",
      pathId: "p_tahsili",
      subjectId: "sub_math",
      sectionId: "sec_math_functions",
      type: "video",
      duration: "20 دقيقة",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_math_functions"],
      approvalStatus: "approved",
    },
    adminToken,
  );

  await ensureLesson(
    {
      title: "مراجعة سريعة على الكسور المركبة",
      description: "مقترح من المعلمة لمزيد من العلاج قبل النشر.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      type: "video",
      duration: "12 دقيقة",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_fractions"],
    },
    teacherQuantToken,
  );

  snapshots = await fetchSnapshots(adminToken);
  const pendingLesson = findLessonBySignature(
    snapshots.content.lessons || [],
    "مراجعة سريعة على الكسور المركبة",
    "p_qudrat",
    "sub_quant",
  );
  if (pendingLesson) {
    await request(
      `/content/lessons/${pendingLesson._id || pendingLesson.id}`,
      "PATCH",
      {
        ownerType: "teacher",
        ownerId: String(teacherQuant?._id || teacherQuant?.id || ""),
        createdBy: String(teacherQuant?._id || teacherQuant?.id || ""),
        assignedTeacherId: String(teacherQuant?._id || teacherQuant?.id || ""),
        approvalStatus: "pending_review",
        approvedBy: "",
        approvedAt: null,
        reviewerNotes: "بانتظار اعتماد الإدارة",
        revenueSharePercentage: 35,
      },
      adminToken,
    );
  }

  snapshots = await fetchSnapshots(adminToken);
  const dynamicFoundationTargets = [
    {
      pathId: "p_qudrat",
      names: ["اللفظي", "لفظي"],
      topicIdPrefix: "topic_seed_dynamic_verbal_context",
      lessonTitle: "تأسيس فهم السياق اللفظي",
      lessonDescription: "درس افتتاحي يوضح طريقة قراءة النص واستخراج الفكرة الرئيسة والاستدلال من السياق.",
      topicTitle: "فهم السياق اللفظي",
      duration: "14 دقيقة",
      fallbackSectionId: "sec_verbal_context",
      fallbackSkillIds: ["skill_verbal_context"],
    },
    {
      pathId: "p_tahsili",
      names: ["الرياضيات", "رياضيات"],
      topicIdPrefix: "topic_seed_dynamic_math_functions",
      lessonTitle: "تأسيس قراءة الدوال من الرسم",
      lessonDescription: "درس افتتاحي يربط الدالة بالتمثيل البياني ويجهز الطالب لتدريبات التحصيلي.",
      topicTitle: "قراءة الدوال والتمثيل البياني",
      duration: "18 دقيقة",
      fallbackSectionId: "sec_math_functions",
      fallbackSkillIds: ["skill_math_functions"],
    },
  ];

  for (const target of dynamicFoundationTargets) {
    const matchingSubjects = findSubjectsByPathAndNames(snapshots.taxonomy.subjects || [], target.pathId, target.names);

    for (const subject of matchingSubjects) {
      const subjectId = String(subject.id || subject._id || "");
      if (!subjectId) continue;

      const section = (snapshots.taxonomy.sections || []).find((item: any) => String(item.subjectId || "") === subjectId);
      const skillIds = (snapshots.taxonomy.skills || [])
        .filter((item: any) => String(item.subjectId || "") === subjectId)
        .map((item: any) => String(item.id || item._id || ""))
        .filter(Boolean);
      const sectionId = String(section?.id || section?._id || target.fallbackSectionId);
      const lesson = await ensureLesson(
        {
          title: target.lessonTitle,
          description: target.lessonDescription,
          pathId: target.pathId,
          subjectId,
          sectionId,
          type: "video",
          duration: target.duration,
          videoUrl: SAMPLE_VIDEO_URL,
          skillIds: skillIds.length ? skillIds.slice(0, 2) : target.fallbackSkillIds,
          approvalStatus: "approved",
          showOnPlatform: true,
        },
        adminToken,
      );
      const lessonId = String(lesson._id || lesson.id || "");
      const topicId = `${target.topicIdPrefix}_${subjectId}`;
      const topicPayload = {
        id: topicId,
        pathId: target.pathId,
        subjectId,
        sectionId,
        title: target.topicTitle,
        parentId: null,
        order: 1,
        showOnPlatform: true,
        lessonIds: lessonId ? [lessonId] : [],
        quizIds: [],
      };
      const topicsById = byIdOrMongoId((await fetchSnapshots(adminToken)).content.topics || []);
      if (topicsById.has(topicId)) {
        await request(`/content/topics/${topicId}`, "PATCH", topicPayload, adminToken);
      } else {
        await request("/content/topics", "POST", topicPayload, adminToken);
      }
    }
  }

  snapshots = await fetchSnapshots(adminToken);
  const questionsById = byIdOrMongoId(snapshots.questions || []);

  const questionSeeds = [
    {
      id: "q_seed_quant_01",
      text: "إذا كان مجموع عددين 18 والفرق بينهما 4، فما العدد الأكبر؟",
      options: ["11", "9", "7", "13"],
      correctOptionIndex: 0,
      explanation: "نجمع المجموع والفرق ثم نقسم على 2.",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_add_sub"],
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_ops",
      difficulty: "Easy",
      type: "mcq",
      approvalStatus: "approved",
    },
    {
      id: "q_seed_quant_02",
      text: "ما قيمة 3/4 من 32؟",
      options: ["18", "20", "24", "28"],
      correctOptionIndex: 2,
      explanation: "نحسب ثلاثة أرباع العدد 32.",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_fractions"],
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_ops",
      difficulty: "Easy",
      type: "mcq",
      approvalStatus: "approved",
    },
    {
      id: "q_seed_quant_03",
      text: "إذا كان 2س + 5 = 17، فما قيمة س؟",
      options: ["4", "5", "6", "7"],
      correctOptionIndex: 2,
      explanation: "ننقل 5 ثم نقسم على 2.",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_equations"],
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_alg",
      difficulty: "Medium",
      type: "mcq",
      approvalStatus: "approved",
    },
    {
      id: "q_seed_quant_04",
      text: "إذا كانت النسبة 4 : 5 وسعر 4 دفاتر 20 ريالًا، فما سعر 5 دفاتر؟",
      options: ["22", "25", "28", "30"],
      correctOptionIndex: 1,
      explanation: "نستخدم التناسب المباشر.",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_proportions"],
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_alg",
      difficulty: "Medium",
      type: "mcq",
      approvalStatus: "approved",
    },
    {
      id: "q_seed_quant_05",
      text: "ما الناتج عند تقريب 17% من 200؟",
      options: ["17", "24", "34", "40"],
      correctOptionIndex: 2,
      explanation: "نحوّل النسبة المئوية إلى كسر عشري.",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_quant_fractions"],
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_ops",
      difficulty: "Medium",
      type: "mcq",
      approvalStatus: "approved",
    },
    {
      id: "q_seed_math_01",
      text: "إذا كانت الدالة ص = 2س + 1، فما قيمة ص عندما س = 3؟",
      options: ["5", "6", "7", "8"],
      correctOptionIndex: 2,
      explanation: "نعوض في الدالة بالقيمة 3.",
      videoUrl: SAMPLE_VIDEO_URL,
      skillIds: ["skill_math_functions"],
      pathId: "p_tahsili",
      subject: "sub_math",
      sectionId: "sec_math_functions",
      difficulty: "Easy",
      type: "mcq",
      approvalStatus: "approved",
    },
  ];

  for (const question of questionSeeds) {
    if (questionsById.has(question.id)) {
      await request(`/quizzes/questions/${question.id}`, "PATCH", question, adminToken);
    } else {
      await request("/quizzes/questions", "POST", question, adminToken);
    }
  }

  if (questionsById.has("q_seed_quant_pending")) {
    await request(
      "/quizzes/questions/q_seed_quant_pending",
      "PATCH",
      {
        text: "إذا كانت ثلاثة أضعاف عدد ما تساوي 21، فما العدد؟",
        options: ["5", "6", "7", "8"],
        correctOptionIndex: 2,
        explanation: "نقسم 21 على 3.",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_quant_equations"],
        pathId: "p_qudrat",
        subject: "sub_quant",
        sectionId: "sec_quant_alg",
        difficulty: "Easy",
        type: "mcq",
      },
      teacherQuantToken,
    );
  } else {
    await request(
      "/quizzes/questions",
      "POST",
      {
        id: "q_seed_quant_pending",
        text: "إذا كانت ثلاثة أضعاف عدد ما تساوي 21، فما العدد؟",
        options: ["5", "6", "7", "8"],
        correctOptionIndex: 2,
        explanation: "نقسم 21 على 3.",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_quant_equations"],
        pathId: "p_qudrat",
        subject: "sub_quant",
        sectionId: "sec_quant_alg",
        difficulty: "Easy",
        type: "mcq",
      },
      teacherQuantToken,
    );
  }

  await request(
    "/quizzes/questions/q_seed_quant_pending",
    "PATCH",
    {
      ownerType: "teacher",
      ownerId: String(teacherQuant?._id || teacherQuant?.id || ""),
      createdBy: String(teacherQuant?._id || teacherQuant?.id || ""),
      assignedTeacherId: String(teacherQuant?._id || teacherQuant?.id || ""),
      approvalStatus: "pending_review",
      approvedBy: "",
      approvedAt: null,
      reviewerNotes: "بانتظار اعتماد الإدارة",
      revenueSharePercentage: 35,
    },
    adminToken,
  );

  snapshots = await fetchSnapshots(adminToken);
  const quizzesById = byIdOrMongoId(snapshots.quizzes || []);

  const quizSeeds = [
    {
      id: "quiz_seed_quant_bank_ops",
      title: "تدريب العمليات والكسور - تشغيل",
      description: "بنك تدريبي قصير على العمليات الأساسية والكسور.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      type: "bank",
      mode: "regular",
      settings: { durationInMinutes: 20, questionCount: 3, showResultsImmediately: true },
      access: { type: "free" },
      questionIds: ["q_seed_quant_01", "q_seed_quant_02", "q_seed_quant_05"],
      skillIds: ["skill_quant_add_sub", "skill_quant_fractions"],
      targetGroupIds: [],
      targetUserIds: [],
      dueDate: null,
      isPublished: true,
      approvalStatus: "approved",
    },
    {
      id: "quiz_seed_quant_saher_followup",
      title: "ساهر علاجي - الكسور والمعادلات",
      description: "اختبار متابعة علاجي موجه لمجموعة القدرات الكمي.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_alg",
      type: "quiz",
      mode: "saher",
      settings: { durationInMinutes: 25, questionCount: 3, showResultsImmediately: true },
      access: { type: "free" },
      questionIds: ["q_seed_quant_02", "q_seed_quant_03", "q_seed_quant_04"],
      skillIds: ["skill_quant_fractions", "skill_quant_equations", "skill_quant_proportions"],
      targetGroupIds: [],
      targetUserIds: [],
      dueDate: null,
      isPublished: true,
      approvalStatus: "approved",
    },
    {
      id: "quiz_seed_quant_central",
      title: "اختبار مركزي - القدرات الكمي (تشغيلي)",
      description: "اختبار مركزي قصير لمتابعة طلاب المجموعة.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      type: "quiz",
      mode: "central",
      settings: { durationInMinutes: 30, questionCount: 4, showResultsImmediately: true },
      access: { type: "free" },
      questionIds: ["q_seed_quant_01", "q_seed_quant_02", "q_seed_quant_03", "q_seed_quant_04"],
      skillIds: ["skill_quant_add_sub", "skill_quant_fractions", "skill_quant_equations", "skill_quant_proportions"],
      targetGroupIds: [],
      targetUserIds: [],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isPublished: true,
      approvalStatus: "approved",
    },
    {
      id: "quiz_seed_math_central",
      title: "اختبار مركزي - التحصيلي رياضيات (تشغيلي)",
      description: "اختبار متابعة على الدوال والتمثيل البياني.",
      pathId: "p_tahsili",
      subjectId: "sub_math",
      sectionId: "sec_math_functions",
      type: "quiz",
      mode: "central",
      settings: { durationInMinutes: 15, questionCount: 1, showResultsImmediately: true },
      access: { type: "free" },
      questionIds: ["q_seed_math_01"],
      skillIds: ["skill_math_functions"],
      targetGroupIds: [],
      targetUserIds: [],
      dueDate: null,
      isPublished: true,
      approvalStatus: "approved",
    },
  ];

  for (const quiz of quizSeeds) {
    if (quizzesById.has(quiz.id)) {
      await request(`/quizzes/${quiz.id}`, "PATCH", quiz, adminToken);
    } else {
      await request("/quizzes", "POST", quiz, adminToken);
    }
  }

  if (quizzesById.has("quiz_seed_pending_review")) {
    await request(
      "/quizzes/quiz_seed_pending_review",
      "PATCH",
      {
        title: "اختبار مقترح من المعلمة - المعادلات",
        description: "مسودة تحتاج اعتماد الإدارة.",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_alg",
        type: "quiz",
        mode: "regular",
        settings: { durationInMinutes: 10, questionCount: 1, showResultsImmediately: true },
        access: { type: "free" },
        questionIds: ["q_seed_quant_pending"],
        targetGroupIds: [],
        targetUserIds: [],
        dueDate: null,
        isPublished: false,
      },
      teacherQuantToken,
    );
  } else {
    await request(
      "/quizzes",
      "POST",
      {
        id: "quiz_seed_pending_review",
        title: "اختبار مقترح من المعلمة - المعادلات",
        description: "مسودة تحتاج اعتماد الإدارة.",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_alg",
        type: "quiz",
        mode: "regular",
        settings: { durationInMinutes: 10, questionCount: 1, showResultsImmediately: true },
        access: { type: "free" },
        questionIds: ["q_seed_quant_pending"],
        targetGroupIds: [],
        targetUserIds: [],
        dueDate: null,
        isPublished: false,
      },
      teacherQuantToken,
    );
  }

  await request(
    "/quizzes/quiz_seed_pending_review",
    "PATCH",
    {
      ownerType: "teacher",
      ownerId: String(teacherQuant?._id || teacherQuant?.id || ""),
      createdBy: String(teacherQuant?._id || teacherQuant?.id || ""),
      assignedTeacherId: String(teacherQuant?._id || teacherQuant?.id || ""),
      approvalStatus: "pending_review",
      approvedBy: "",
      approvedAt: null,
      reviewerNotes: "بانتظار اعتماد الإدارة",
      revenueSharePercentage: 35,
      isPublished: false,
    },
    adminToken,
  );

  snapshots = await fetchSnapshots(adminToken);
  const libraryById = byIdOrMongoId(snapshots.content.libraryItems || []);

  const librarySeeds = [
    {
      id: "lib_seed_quant_summary",
      title: "ملخص الكسور والنسب - تشغيل",
      size: "2.1 MB",
      downloads: 0,
      type: "pdf",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      skillIds: ["skill_quant_fractions"],
      url: SAMPLE_PDF_URL,
      approvalStatus: "approved",
    },
    {
      id: "lib_seed_math_sheet",
      title: "ورقة مراجعة الدوال - تشغيل",
      size: "1.6 MB",
      downloads: 0,
      type: "pdf",
      pathId: "p_tahsili",
      subjectId: "sub_math",
      sectionId: "sec_math_functions",
      skillIds: ["skill_math_functions"],
      url: SAMPLE_PDF_URL,
      approvalStatus: "approved",
    },
  ];

  for (const item of librarySeeds) {
    if (libraryById.has(item.id)) {
      await request(`/content/library-items/${item.id}`, "PATCH", item, adminToken);
    } else {
      await request("/content/library-items", "POST", item, adminToken);
    }
  }

  if (libraryById.has("lib_seed_teacher_pending")) {
    await request(
      "/content/library-items/lib_seed_teacher_pending",
      "PATCH",
      {
        title: "ورقة إضافية مقترحة - الكسور المركبة",
        size: "1.0 MB",
        downloads: 0,
        type: "pdf",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_ops",
        skillIds: ["skill_quant_fractions"],
        url: SAMPLE_PDF_URL,
      },
      teacherQuantToken,
    );
  } else {
    await request(
      "/content/library-items",
      "POST",
      {
        id: "lib_seed_teacher_pending",
        title: "ورقة إضافية مقترحة - الكسور المركبة",
        size: "1.0 MB",
        downloads: 0,
        type: "pdf",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_ops",
        skillIds: ["skill_quant_fractions"],
        url: SAMPLE_PDF_URL,
      },
      teacherQuantToken,
    );
  }

  await request(
    "/content/library-items/lib_seed_teacher_pending",
    "PATCH",
    {
      ownerType: "teacher",
      ownerId: String(teacherQuant?._id || teacherQuant?.id || ""),
      createdBy: String(teacherQuant?._id || teacherQuant?.id || ""),
      assignedTeacherId: String(teacherQuant?._id || teacherQuant?.id || ""),
      approvalStatus: "pending_review",
      approvedBy: "",
      approvedAt: null,
      reviewerNotes: "بانتظار اعتماد الإدارة",
      revenueSharePercentage: 35,
    },
    adminToken,
  );

  snapshots = await fetchSnapshots(adminToken);
  const coursesById = byIdOrMongoId(snapshots.courses || []);

  const courseSeeds = [
    {
      id: "course_seed_quant_mastery",
      title: "الإتقان في القدرات الكمي - تشغيل",
      thumbnail: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80",
      instructor: "فريق منصة المئة",
      price: 149,
      currency: "SAR",
      duration: 180,
      level: "Intermediate",
      rating: 4.8,
      progress: 0,
      category: "القدرات",
      subject: "الكمي",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      features: ["تأسيس", "تدريبات", "اختبارات محاكية", "تقارير مهارية"],
      description: "دورة تشغيلية تغطي التأسيس والتدريب والاختبار على القدرات الكمي.",
      instructorBio: "محتوى تشغيلي معتمد من الإدارة للاختبار الواقعي.",
      modules: [
        {
          id: "module_quant_01",
          title: "العمليات الأساسية",
          lessons: [
            { id: `embedded_${lessonOps._id || lessonOps.id}`, title: lessonOps.title, type: "video", duration: lessonOps.duration },
            { id: `embedded_${lessonFractions._id || lessonFractions.id}`, title: lessonFractions.title, type: "video", duration: lessonFractions.duration },
          ],
        },
        {
          id: "module_quant_02",
          title: "الجبر والتناسب",
          lessons: [
            { id: `embedded_${lessonEquations._id || lessonEquations.id}`, title: lessonEquations.title, type: "video", duration: lessonEquations.duration },
          ],
        },
      ],
      isPublished: true,
      isPackage: false,
      originalPrice: 199,
      skills: ["skill_quant_add_sub", "skill_quant_fractions", "skill_quant_equations", "skill_quant_proportions"],
      approvalStatus: "approved",
      certificateEnabled: true,
    },
    {
      id: "course_seed_math_mastery",
      title: "التحصيلي رياضيات - تشغيل",
      thumbnail: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80",
      instructor: "أ. خالد الرياضيات",
      price: 129,
      currency: "SAR",
      duration: 90,
      level: "Intermediate",
      rating: 4.7,
      progress: 0,
      category: "التحصيلي",
      subject: "الرياضيات",
      pathId: "p_tahsili",
      subjectId: "sub_math",
      sectionId: "sec_math_functions",
      features: ["فيديوهات", "اختبارات متابعة", "تقارير مهارية"],
      description: "وحدة تشغيلية على الدوال والتمثيل البياني للتحصيلي.",
      instructorBio: "مادة معلم معتمدة للنشر.",
      modules: [
        {
          id: "module_math_01",
          title: "الدوال والتمثيل",
          lessons: [
            { id: `embedded_${lessonMath._id || lessonMath.id}`, title: lessonMath.title, type: "video", duration: lessonMath.duration },
          ],
        },
      ],
      isPublished: true,
      isPackage: false,
      originalPrice: 159,
      skills: ["skill_math_functions"],
      approvalStatus: "approved",
      certificateEnabled: true,
      assignedTeacherId: teacherMath?._id || teacherMath?.id,
      revenueSharePercentage: 35,
    },
  ];

  for (const course of courseSeeds) {
    if (coursesById.has(course.id)) {
      await request(`/courses/${course.id}`, "PATCH", course, adminToken);
    } else {
      await request("/courses", "POST", course, adminToken);
    }
  }

  if (coursesById.has("course_seed_teacher_pending")) {
    await request(
      "/courses/course_seed_teacher_pending",
      "PATCH",
      {
        title: "دورة مقترحة من المعلمة - مراجعة الكسور",
        thumbnail: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
        instructor: "أ. ريم الكمي",
        price: 59,
        currency: "SAR",
        duration: 45,
        level: "Beginner",
        rating: 0,
        progress: 0,
        category: "القدرات",
        subject: "الكمي",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_ops",
        features: ["مراجعة علاجية"],
        description: "دورة لمراجعة الكسور المركبة قبل الاعتماد.",
        modules: [],
        isPublished: false,
        skills: ["skill_quant_fractions"],
      },
      teacherQuantToken,
    );
  } else {
    await request(
      "/courses",
      "POST",
      {
        id: "course_seed_teacher_pending",
        title: "دورة مقترحة من المعلمة - مراجعة الكسور",
        thumbnail: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80",
        instructor: "أ. ريم الكمي",
        price: 59,
        currency: "SAR",
        duration: 45,
        level: "Beginner",
        rating: 0,
        progress: 0,
        category: "القدرات",
        subject: "الكمي",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_ops",
        features: ["مراجعة علاجية"],
        description: "دورة لمراجعة الكسور المركبة قبل الاعتماد.",
        modules: [],
        isPublished: false,
        skills: ["skill_quant_fractions"],
      },
      teacherQuantToken,
    );
  }

  await request(
    "/courses/course_seed_teacher_pending",
    "PATCH",
    {
      ownerType: "teacher",
      ownerId: String(teacherQuant?._id || teacherQuant?.id || ""),
      createdBy: String(teacherQuant?._id || teacherQuant?.id || ""),
      assignedTeacherId: String(teacherQuant?._id || teacherQuant?.id || ""),
      approvalStatus: "pending_review",
      approvedBy: "",
      approvedAt: null,
      reviewerNotes: "بانتظار اعتماد الإدارة",
      revenueSharePercentage: 35,
      isPublished: false,
    },
    adminToken,
  );

  snapshots = await fetchSnapshots(adminToken);
  const topicsById = byIdOrMongoId(snapshots.content.topics || []);

  const topicSeeds = [
    {
      id: "topic_seed_quant_main_ops",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      title: "ترتيب العمليات الحسابية",
      parentId: null,
      order: 1,
      lessonIds: [String(lessonOps._id || lessonOps.id)],
      quizIds: ["quiz_seed_quant_bank_ops"],
    },
    {
      id: "topic_seed_quant_sub_fractions",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      title: "الكسور والنسب",
      parentId: "topic_seed_quant_main_ops",
      order: 2,
      lessonIds: [String(lessonFractions._id || lessonFractions.id)],
      quizIds: ["quiz_seed_quant_saher_followup"],
    },
    {
      id: "topic_seed_quant_main_alg",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_alg",
      title: "حل المعادلات",
      parentId: null,
      order: 3,
      lessonIds: [String(lessonEquations._id || lessonEquations.id)],
      quizIds: ["quiz_seed_quant_central"],
    },
  ];

  for (const topic of topicSeeds) {
    if (topicsById.has(topic.id)) {
      await request(`/content/topics/${topic.id}`, "PATCH", topic, adminToken);
    } else {
      await request("/content/topics", "POST", topic, adminToken);
    }
  }

  return {
    lessonIds: {
      lessonOps: String(lessonOps._id || lessonOps.id),
      lessonFractions: String(lessonFractions._id || lessonFractions.id),
      lessonEquations: String(lessonEquations._id || lessonEquations.id),
      lessonMath: String(lessonMath._id || lessonMath.id),
    },
  };
}

async function upsertGroupsAndAssignments(adminToken: string, usersByEmail: Map<string, any>) {
  const snapshots = await fetchSnapshots(adminToken);
  const groups = snapshots.content.groups || [];

  const adminUser = usersByEmail.get(ADMIN_EMAIL.toLowerCase());
  const teacherQuant = usersByEmail.get("teacher.quant@almeaa.local");
  const teacherMath = usersByEmail.get("teacher.math@almeaa.local");
  const schoolSupervisor = usersByEmail.get("supervisor.school@almeaa.local");
  const groupSupervisor = usersByEmail.get("supervisor.group@almeaa.local");
  const studentA = usersByEmail.get("student.a@almeaa.local");
  const studentB = usersByEmail.get("student.b@almeaa.local");
  const studentC = usersByEmail.get("student.c@almeaa.local");
  const studentD = usersByEmail.get("student.d@almeaa.local");

  const upsertGroup = async (name: string, type: "SCHOOL" | "CLASS", payload: any) => {
    const existing = findGroupByName(groups, name, type);
    if (existing) {
      return request<any>(`/content/groups/${existing._id || existing.id}`, "PATCH", payload, adminToken);
    }
    return request<any>("/content/groups", "POST", payload, adminToken);
  };

  const school = await upsertGroup("مدرسة الريادة - تشغيل", "SCHOOL", {
    name: "مدرسة الريادة - تشغيل",
    type: "SCHOOL",
    parentId: null,
    ownerId: String(adminUser._id || adminUser.id),
    supervisorIds: [String(schoolSupervisor._id || schoolSupervisor.id)],
    studentIds: [String(studentA._id || studentA.id), String(studentB._id || studentB.id), String(studentC._id || studentC.id), String(studentD._id || studentD.id)],
    courseIds: ["course_seed_quant_mastery", "course_seed_math_mastery"],
    metadata: {
      description: "مدرسة تشغيلية لاختبارات الجودة والتقارير.",
      location: "الرياض",
      settings: { allowParentFollowUp: true },
    },
  });

  const quantClass = await upsertGroup("مجموعة القدرات الكمي - تشغيل", "CLASS", {
    name: "مجموعة القدرات الكمي - تشغيل",
    type: "CLASS",
    parentId: String(school._id || school.id),
    ownerId: String(adminUser._id || adminUser.id),
    supervisorIds: [String(groupSupervisor._id || groupSupervisor.id)],
    studentIds: [String(studentA._id || studentA.id), String(studentB._id || studentB.id)],
    courseIds: ["course_seed_quant_mastery"],
    metadata: {
      description: "مجموعة علاجية على القدرات الكمي.",
      location: "الرياض",
      settings: { focusSubjectId: "sub_quant" },
    },
  });

  const mathClass = await upsertGroup("مجموعة التحصيلي رياضيات - تشغيل", "CLASS", {
    name: "مجموعة التحصيلي رياضيات - تشغيل",
    type: "CLASS",
    parentId: String(school._id || school.id),
    ownerId: String(adminUser._id || adminUser.id),
    supervisorIds: [String(schoolSupervisor._id || schoolSupervisor.id)],
    studentIds: [String(studentC._id || studentC.id)],
    courseIds: ["course_seed_math_mastery"],
    metadata: {
      description: "مجموعة متابعة مادة الرياضيات التحصيلي.",
      location: "الرياض",
      settings: { focusSubjectId: "sub_math" },
    },
  });

  await request(`/auth/admin/users/${schoolSupervisor._id || schoolSupervisor.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(school._id || school.id), String(mathClass._id || mathClass.id)],
  }, adminToken);

  await request(`/auth/admin/users/${groupSupervisor._id || groupSupervisor.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(school._id || school.id), String(quantClass._id || quantClass.id)],
  }, adminToken);

  await request(`/auth/admin/users/${teacherQuant._id || teacherQuant.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(quantClass._id || quantClass.id)],
    managedPathIds: ["p_qudrat"],
    managedSubjectIds: ["sub_quant"],
  }, adminToken);

  await request(`/auth/admin/users/${teacherMath._id || teacherMath.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(mathClass._id || mathClass.id)],
    managedPathIds: ["p_tahsili"],
    managedSubjectIds: ["sub_math"],
  }, adminToken);

  await request(`/auth/admin/users/${studentA._id || studentA.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(quantClass._id || quantClass.id)],
  }, adminToken);

  await request(`/auth/admin/users/${studentB._id || studentB.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(quantClass._id || quantClass.id)],
  }, adminToken);

  await request(`/auth/admin/users/${studentC._id || studentC.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(mathClass._id || mathClass.id)],
  }, adminToken);

  await request(`/auth/admin/users/${studentD._id || studentD.id}`, "PATCH", {
    schoolId: String(school._id || school.id),
    groupIds: [String(school._id || school.id)],
  }, adminToken);

  const parentA = usersByEmail.get("parent.a@almeaa.local");
  const parentB = usersByEmail.get("parent.b@almeaa.local");

  await request(`/auth/admin/users/${parentA._id || parentA.id}`, "PATCH", {
    linkedStudentIds: [String(studentA._id || studentA.id)],
  }, adminToken);
  await request(`/auth/admin/users/${parentB._id || parentB.id}`, "PATCH", {
    linkedStudentIds: [String(studentB._id || studentB.id)],
  }, adminToken);

  return {
    schoolId: String(school._id || school.id),
    quantClassId: String(quantClass._id || quantClass.id),
    mathClassId: String(mathClass._id || mathClass.id),
  };
}

async function upsertPackagesAndCodes(adminToken: string, schoolId: string) {
  const snapshots = await fetchSnapshots(adminToken);
  const packagesById = byIdOrMongoId(snapshots.content.b2bPackages || []);
  const codesById = byIdOrMongoId(snapshots.content.accessCodes || []);

  const packageSeeds = [
    {
      id: "pkg_seed_school_quant_full",
      schoolId,
      name: "باقة مدرسة الريادة - قدرات كمي شاملة",
      courseIds: ["course_seed_quant_mastery"],
      contentTypes: ["courses", "foundation", "banks", "tests", "library"],
      pathIds: ["p_qudrat"],
      subjectIds: ["sub_quant"],
      type: "free_access",
      discountPercentage: null,
      maxStudents: 120,
      status: "active",
    },
    {
      id: "pkg_seed_school_math_tests",
      schoolId,
      name: "باقة اختبارات التحصيلي رياضيات",
      courseIds: ["course_seed_math_mastery"],
      contentTypes: ["tests", "library"],
      pathIds: ["p_tahsili"],
      subjectIds: ["sub_math"],
      type: "discounted",
      discountPercentage: 35,
      maxStudents: 60,
      status: "active",
    },
  ];

  for (const item of packageSeeds) {
    if (packagesById.has(item.id)) {
      await request(`/content/b2b-packages/${item.id}`, "PATCH", item, adminToken);
    } else {
      await request("/content/b2b-packages", "POST", item, adminToken);
    }
  }

  const accessCode = {
    id: "code_seed_riyadah_quant",
    code: "RIYADA-QUANT-2026",
    schoolId,
    packageId: "pkg_seed_school_quant_full",
    maxUses: 25,
    currentUses: 0,
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
  };

  if (codesById.has(accessCode.id)) {
    await request(`/content/access-codes/${accessCode.id}`, "PATCH", accessCode, adminToken);
  } else {
    await request("/content/access-codes", "POST", accessCode, adminToken);
  }
}

async function seedStudentStateAndResults() {
  const studentALogin = await login("student.a@almeaa.local", "Student@123");
  const studentBLogin = await login("student.b@almeaa.local", "Student@123");
  const studentCLogin = await login("student.c@almeaa.local", "Student@123");
  const studentDLogin = await login("student.d@almeaa.local", "Student@123");

  const ensurePurchase = async (session: AuthSession, payload: any) => {
    const me = await request<any>("/auth/me", "GET", undefined, session.token);
    const purchasedCourses = me.user?.subscription?.purchasedCourses || [];
    const purchasedPackages = me.user?.subscription?.purchasedPackages || [];
    const shouldPurchaseCourse = payload.courseId && !purchasedCourses.includes(payload.courseId);
    const shouldPurchasePackage = payload.packageId && !purchasedPackages.includes(payload.packageId);
    if (shouldPurchaseCourse || shouldPurchasePackage) {
      await request("/auth/me/purchase", "POST", payload, session.token);
    }
  };

  await ensurePurchase(studentALogin, {
    courseId: "course_seed_quant_mastery",
    packageId: "pkg_seed_school_quant_full",
    includedCourseIds: ["course_seed_quant_mastery"],
  });

  await ensurePurchase(studentBLogin, {
    courseId: "course_seed_quant_mastery",
    packageId: "pkg_seed_school_quant_full",
    includedCourseIds: ["course_seed_quant_mastery"],
  });

  await ensurePurchase(studentCLogin, {
    courseId: "course_seed_math_mastery",
    packageId: "pkg_seed_school_math_tests",
    includedCourseIds: ["course_seed_math_mastery"],
  });

  const studentDMe = await request<any>("/auth/me", "GET", undefined, studentDLogin.token);
  const studentDPackages = studentDMe.user?.subscription?.purchasedPackages || [];
  if (!studentDPackages.includes("pkg_seed_school_quant_full")) {
    await request("/auth/me/redeem-access-code", "POST", { code: "RIYADA-QUANT-2026" }, studentDLogin.token);
  }

  await request("/auth/me/preferences", "PATCH", {
    favorites: ["q_seed_quant_02", "q_seed_quant_03"],
    reviewLater: ["q_seed_quant_05"],
  }, studentALogin.token);

  const seedResultIfMissing = async (session: AuthSession, quizTitle: string, payload: any) => {
    const existing = await request<any[]>("/quizzes/results", "GET", undefined, session.token);
    if (existing.some((item) => String(item.quizTitle || "") === quizTitle)) {
      return;
    }
    await request("/quizzes/results", "POST", payload, session.token);
  };

  await seedResultIfMissing(studentALogin, "اختبار مركزي - القدرات الكمي (تشغيلي)", {
    quizId: "quiz_seed_quant_central",
    quizTitle: "اختبار مركزي - القدرات الكمي (تشغيلي)",
    score: 58,
    totalQuestions: 4,
    correctAnswers: 2,
    wrongAnswers: 2,
    unanswered: 0,
    timeSpent: "00:18:20",
    date: new Date().toISOString(),
    skillsAnalysis: [
      {
        skillId: "skill_quant_fractions",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        subjectName: "الكمي",
        sectionId: "sec_quant_ops",
        sectionName: "العمليات الحسابية",
        skill: "الكسور والنسب",
        mastery: 42,
        status: "weak",
        recommendation: "ينصح بإعادة شرح الكسور ثم حل تدريب علاجي.",
      },
      {
        skillId: "skill_quant_equations",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        subjectName: "الكمي",
        sectionId: "sec_quant_alg",
        sectionName: "الجبر والمعادلات",
        skill: "حل المعادلات",
        mastery: 61,
        status: "average",
        recommendation: "يحتاج إلى اختبار متابعة قصير.",
      },
    ],
    questionReview: [],
  });

  await seedResultIfMissing(studentBLogin, "ساهر علاجي - الكسور والمعادلات", {
    quizId: "quiz_seed_quant_saher_followup",
    quizTitle: "ساهر علاجي - الكسور والمعادلات",
    score: 71,
    totalQuestions: 3,
    correctAnswers: 2,
    wrongAnswers: 1,
    unanswered: 0,
    timeSpent: "00:12:11",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    skillsAnalysis: [
      {
        skillId: "skill_quant_fractions",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        subjectName: "الكمي",
        sectionId: "sec_quant_ops",
        sectionName: "العمليات الحسابية",
        skill: "الكسور والنسب",
        mastery: 74,
        status: "average",
        recommendation: "يحتاج إلى تدريب إضافي قبل الانتقال.",
      },
      {
        skillId: "skill_quant_equations",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        subjectName: "الكمي",
        sectionId: "sec_quant_alg",
        sectionName: "الجبر والمعادلات",
        skill: "حل المعادلات",
        mastery: 78,
        status: "strong",
        recommendation: "يمكنه الانتقال إلى مهارات أعلى.",
      },
    ],
    questionReview: [],
  });

  await seedResultIfMissing(studentCLogin, "اختبار مركزي - التحصيلي رياضيات (تشغيلي)", {
    quizId: "quiz_seed_math_central",
    quizTitle: "اختبار مركزي - التحصيلي رياضيات (تشغيلي)",
    score: 67,
    totalQuestions: 1,
    correctAnswers: 0,
    wrongAnswers: 1,
    unanswered: 0,
    timeSpent: "00:09:05",
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    skillsAnalysis: [
      {
        skillId: "skill_math_functions",
        pathId: "p_tahsili",
        subjectId: "sub_math",
        subjectName: "الرياضيات",
        sectionId: "sec_math_functions",
        sectionName: "الدوال والتمثيل البياني",
        skill: "تحليل الدوال",
        mastery: 67,
        status: "average",
        recommendation: "أعد مشاهدة درس الدوال ثم نفذ اختبار متابعة جديد.",
      },
    ],
    questionReview: [],
  });
}

async function runSmokeChecks(schoolId: string) {
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const teacher = await login("teacher.quant@almeaa.local", "Teacher@123");
  const supervisor = await login("supervisor.group@almeaa.local", "Supervisor@123");
  const student = await login("student.a@almeaa.local", "Student@123");
  const parent = await login("parent.a@almeaa.local", "Parent@123");

  const [adminAnalytics, teacherAnalytics, supervisorAnalytics, parentAnalytics, studentResults, schoolReport, studentQuizzes, studentCourses] =
    await Promise.all([
      request<any>("/quizzes/analytics/overview", "GET", undefined, admin.token),
      request<any>("/quizzes/analytics/overview", "GET", undefined, teacher.token),
      request<any>("/quizzes/analytics/overview", "GET", undefined, supervisor.token),
      request<any>("/quizzes/analytics/overview", "GET", undefined, parent.token),
      request<any[]>("/quizzes/results", "GET", undefined, student.token),
      request<any>(`/content/schools/${schoolId}/report`, "GET", undefined, supervisor.token),
      request<any[]>("/quizzes", "GET", undefined, student.token),
      request<any[]>("/courses", "GET", undefined, student.token),
    ]);

  return {
    adminWeakestStudents: adminAnalytics.weakestStudents?.length || 0,
    teacherWeakestSkills: teacherAnalytics.weakestSkills?.length || 0,
    supervisorWeakestStudents: supervisorAnalytics.weakestStudents?.length || 0,
    parentLinkedStudents: parentAnalytics.weakestStudents?.length || 0,
    studentResults: studentResults.length,
    studentAvailableQuizzes: studentQuizzes.length,
    studentAvailableCourses: studentCourses.length,
    schoolClasses: schoolReport.metrics?.totalClasses || 0,
    schoolPackages: schoolReport.metrics?.activePackages || 0,
  };
}

async function main() {
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await upsertTaxonomy(admin.token, await fetchSnapshots(admin.token));
  const usersByEmail = await upsertUsers(admin.token);

  const teacherQuantLogin = await login("teacher.quant@almeaa.local", "Teacher@123");
  const teacherMathLogin = await login("teacher.math@almeaa.local", "Teacher@123");

  await upsertLessonsQuestionsEtc(admin.token, teacherQuantLogin.token, teacherMathLogin.token, usersByEmail);
  const groups = await upsertGroupsAndAssignments(admin.token, usersByEmail);
  await upsertPackagesAndCodes(admin.token, groups.schoolId);
  await seedStudentStateAndResults();

  const smoke = await runSmokeChecks(groups.schoolId);
  const snapshots = await fetchSnapshots(admin.token);

  const summary = {
    paths: snapshots.taxonomy.paths.length,
    subjects: snapshots.taxonomy.subjects.length,
    sections: snapshots.taxonomy.sections.length,
    skills: snapshots.taxonomy.skills.length,
    lessons: snapshots.content.lessons.length,
    topics: snapshots.content.topics.length,
    libraryItems: snapshots.content.libraryItems.length,
    groups: snapshots.content.groups.length,
    packages: snapshots.content.b2bPackages.length,
    accessCodes: snapshots.content.accessCodes.length,
    questions: snapshots.questions.length,
    quizzes: snapshots.quizzes.length,
    courses: snapshots.courses.length,
  };

  console.log("Operational scenario seeded via API successfully");
  console.log(JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(smoke, null, 2));
  console.log(
    JSON.stringify(
      {
        admin: `${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`,
        teacherQuant: "teacher.quant@almeaa.local / Teacher@123",
        teacherMath: "teacher.math@almeaa.local / Teacher@123",
        supervisor: "supervisor.group@almeaa.local / Supervisor@123",
        studentA: "student.a@almeaa.local / Student@123",
        parentA: "parent.a@almeaa.local / Parent@123",
        accessCode: "RIYADA-QUANT-2026",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Failed to seed operational scenario via API");
  console.error(error);
  process.exit(1);
});

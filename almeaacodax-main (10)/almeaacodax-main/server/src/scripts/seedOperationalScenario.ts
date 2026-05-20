import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/db.js";
import { PathModel } from "../models/Path.js";
import { LevelModel } from "../models/Level.js";
import { SubjectModel } from "../models/Subject.js";
import { SectionModel } from "../models/Section.js";
import { SkillModel } from "../models/Skill.js";
import { UserModel } from "../models/User.js";
import { GroupModel } from "../models/Group.js";
import { LessonModel } from "../models/Lesson.js";
import { QuestionModel } from "../models/Question.js";
import { QuizModel } from "../models/Quiz.js";
import { TopicModel } from "../models/Topic.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { CourseModel } from "../models/Course.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { ActivityModel } from "../models/Activity.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { AccessCodeModel } from "../models/AccessCode.js";

const NOW = Date.now();
const SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4";
const SAMPLE_PDF_URL = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

type SeedUser = {
  key: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "teacher" | "student" | "supervisor" | "parent";
  managedPathIds?: string[];
  managedSubjectIds?: string[];
  linkedStudentIds?: string[];
  schoolId?: string | null;
  groupIds?: string[];
  subscription?: {
    plan: "free" | "premium";
    purchasedCourses?: string[];
    purchasedPackages?: string[];
  };
  enrolledCourses?: string[];
  enrolledPaths?: string[];
  completedLessons?: string[];
  isActive?: boolean;
};

const basePaths = [
  {
    _id: "p_qudrat",
    name: "مسار القدرات",
    color: "purple",
    icon: "🧠",
    showInNavbar: true,
    showInHome: true,
    isActive: true,
    description: "مسار القدرات العامة بفرعيه الكمي واللفظي.",
  },
  {
    _id: "p_tahsili",
    name: "مسار التحصيلي",
    color: "blue",
    icon: "🎓",
    showInNavbar: true,
    showInHome: true,
    isActive: true,
    description: "مسار التحصيلي العلمي والمواد المرتبطة به.",
  },
];

const baseLevels = [
  { _id: "lvl_qudrat_general", pathId: "p_qudrat", name: "عام" },
  { _id: "lvl_tahsili_scientific", pathId: "p_tahsili", name: "علمي" },
];

const baseSubjects = [
  { _id: "sub_quant", pathId: "p_qudrat", levelId: "lvl_qudrat_general", name: "الكمي", color: "purple", icon: "📘" },
  { _id: "sub_verbal", pathId: "p_qudrat", levelId: "lvl_qudrat_general", name: "اللفظي", color: "amber", icon: "📚" },
  { _id: "sub_math", pathId: "p_tahsili", levelId: "lvl_tahsili_scientific", name: "الرياضيات", color: "blue", icon: "📐" },
];

const sectionSeeds = [
  { _id: "sec_quant_ops", subjectId: "sub_quant", name: "العمليات الحسابية" },
  { _id: "sec_quant_alg", subjectId: "sub_quant", name: "الجبر والمعادلات" },
  { _id: "sec_verbal_reading", subjectId: "sub_verbal", name: "الاستيعاب اللفظي" },
  { _id: "sec_math_functions", subjectId: "sub_math", name: "الدوال والتمثيل البياني" },
];

const skillSeeds = [
  {
    _id: "skill_quant_add_sub",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_ops",
    name: "الجمع والطرح السريع",
    description: "إتقان العمليات الأساسية في مسائل القدرات الكمي.",
  },
  {
    _id: "skill_quant_fractions",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_ops",
    name: "الكسور والنسب",
    description: "تحويل الكسور والنسب المئوية وحل مسائل المقارنة.",
  },
  {
    _id: "skill_quant_equations",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_alg",
    name: "حل المعادلات",
    description: "تحليل المعادلات الخطية والتعامل مع المجهول بمرونة.",
  },
  {
    _id: "skill_quant_proportions",
    pathId: "p_qudrat",
    subjectId: "sub_quant",
    sectionId: "sec_quant_alg",
    name: "التناسب والطردي والعكسي",
    description: "فهم العلاقات التناسبية وتطبيقها على أسئلة القدرات.",
  },
  {
    _id: "skill_verbal_context",
    pathId: "p_qudrat",
    subjectId: "sub_verbal",
    sectionId: "sec_verbal_reading",
    name: "فهم السياق",
    description: "تحديد معنى النص واستنتاج الفكرة الرئيسة.",
  },
  {
    _id: "skill_math_functions",
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
    subscription: { plan: "premium" },
    enrolledPaths: ["p_qudrat"],
  },
  {
    key: "teacherMath",
    name: "أ. خالد الرياضيات",
    email: "teacher.math@almeaa.local",
    password: "Teacher@123",
    role: "teacher",
    managedPathIds: ["p_tahsili"],
    managedSubjectIds: ["sub_math"],
    subscription: { plan: "premium" },
    enrolledPaths: ["p_tahsili"],
  },
  {
    key: "schoolSupervisor",
    name: "أ. نورة مشرفة المدرسة",
    email: "supervisor.school@almeaa.local",
    password: "Supervisor@123",
    role: "supervisor",
    subscription: { plan: "premium" },
  },
  {
    key: "groupSupervisor",
    name: "أ. فهد مشرف المجموعة",
    email: "supervisor.group@almeaa.local",
    password: "Supervisor@123",
    role: "supervisor",
    subscription: { plan: "premium" },
  },
  {
    key: "studentA",
    name: "سلمان أحمد",
    email: "student.a@almeaa.local",
    password: "Student@123",
    role: "student",
    subscription: { plan: "premium" },
  },
  {
    key: "studentB",
    name: "ليان محمد",
    email: "student.b@almeaa.local",
    password: "Student@123",
    role: "student",
    subscription: { plan: "premium" },
  },
  {
    key: "studentC",
    name: "مشعل عبدالعزيز",
    email: "student.c@almeaa.local",
    password: "Student@123",
    role: "student",
    subscription: { plan: "premium" },
  },
  {
    key: "studentD",
    name: "جود خالد",
    email: "student.d@almeaa.local",
    password: "Student@123",
    role: "student",
    subscription: { plan: "free" },
  },
  {
    key: "parentA",
    name: "أم سلمان",
    email: "parent.a@almeaa.local",
    password: "Parent@123",
    role: "parent",
    subscription: { plan: "free" },
  },
  {
    key: "parentB",
    name: "ولي أمر ليان",
    email: "parent.b@almeaa.local",
    password: "Parent@123",
    role: "parent",
    subscription: { plan: "free" },
  },
];

async function upsertUser(user: SeedUser) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  return UserModel.findOneAndUpdate(
    { email: user.email.toLowerCase() },
    {
      name: user.name,
      email: user.email.toLowerCase(),
      passwordHash,
      role: user.role,
      isActive: user.isActive ?? true,
      managedPathIds: user.managedPathIds || [],
      managedSubjectIds: user.managedSubjectIds || [],
      linkedStudentIds: user.linkedStudentIds || [],
      schoolId: user.schoolId ?? null,
      groupIds: user.groupIds || [],
      subscription: {
        plan: user.subscription?.plan || "free",
        purchasedCourses: user.subscription?.purchasedCourses || [],
        purchasedPackages: user.subscription?.purchasedPackages || [],
      },
      enrolledCourses: user.enrolledCourses || [],
      enrolledPaths: user.enrolledPaths || [],
      completedLessons: user.completedLessons || [],
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function seedTaxonomy() {
  await Promise.all(
    basePaths.map((path) =>
      PathModel.findByIdAndUpdate(path._id, path, { upsert: true, new: true, setDefaultsOnInsert: true }),
    ),
  );
  await Promise.all(
    baseLevels.map((level) =>
      LevelModel.findByIdAndUpdate(level._id, level, { upsert: true, new: true, setDefaultsOnInsert: true }),
    ),
  );
  await Promise.all(
    baseSubjects.map((subject) =>
      SubjectModel.findByIdAndUpdate(subject._id, subject, { upsert: true, new: true, setDefaultsOnInsert: true }),
    ),
  );
  await Promise.all(
    sectionSeeds.map((section) =>
      SectionModel.findByIdAndUpdate(section._id, section, { upsert: true, new: true, setDefaultsOnInsert: true }),
    ),
  );
  await Promise.all(
    skillSeeds.map((skill) =>
      SkillModel.findByIdAndUpdate(
        skill._id,
        { ...skill, lessonIds: [], questionIds: [] },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );
}

async function seedUsersAndGroups() {
  const admin = await UserModel.findOne({ email: "nasef64@gmail.com" });
  if (!admin) {
    throw new Error("Admin account must exist before operational seed.");
  }

  const createdUsers = new Map<string, any>();
  for (const user of seedUsers) {
    const doc = await upsertUser(user);
    createdUsers.set(user.key, doc);
  }

  const school = await GroupModel.findOneAndUpdate(
    { name: "مدرسة الريادة - تشغيل" },
    {
      name: "مدرسة الريادة - تشغيل",
      type: "SCHOOL",
      ownerId: String(admin.id),
      supervisorIds: [String(createdUsers.get("schoolSupervisor").id)],
      studentIds: [],
      courseIds: [],
      metadata: {
        description: "مدرسة تشغيلية لاختبار العقود والباقات والمتابعة.",
        location: "الرياض",
        settings: { seedScenario: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const quantClass = await GroupModel.findOneAndUpdate(
    { name: "مجموعة القدرات الكمي - تشغيل", type: "CLASS", parentId: String(school.id) },
    {
      name: "مجموعة القدرات الكمي - تشغيل",
      type: "CLASS",
      parentId: String(school.id),
      ownerId: String(admin.id),
      supervisorIds: [String(createdUsers.get("groupSupervisor").id)],
      studentIds: [],
      courseIds: [],
      metadata: {
        description: "مجموعة تشغيلية لمتابعة طلاب القدرات الكمي.",
        settings: { seedScenario: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const tahsiliClass = await GroupModel.findOneAndUpdate(
    { name: "مجموعة التحصيلي رياضيات - تشغيل", type: "CLASS", parentId: String(school.id) },
    {
      name: "مجموعة التحصيلي رياضيات - تشغيل",
      type: "CLASS",
      parentId: String(school.id),
      ownerId: String(admin.id),
      supervisorIds: [String(createdUsers.get("schoolSupervisor").id)],
      studentIds: [],
      courseIds: [],
      metadata: {
        description: "مجموعة تشغيلية للتحصيلي رياضيات.",
        settings: { seedScenario: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const studentAssignments = [
    { key: "studentA", groupIds: [String(quantClass.id)], enrolledPaths: ["p_qudrat"], schoolId: String(school.id) },
    { key: "studentB", groupIds: [String(quantClass.id)], enrolledPaths: ["p_qudrat"], schoolId: String(school.id) },
    { key: "studentC", groupIds: [String(tahsiliClass.id)], enrolledPaths: ["p_tahsili"], schoolId: String(school.id) },
    { key: "studentD", groupIds: [String(quantClass.id)], enrolledPaths: ["p_qudrat"], schoolId: String(school.id) },
  ];

  for (const assignment of studentAssignments) {
    const doc = createdUsers.get(assignment.key);
    await UserModel.findByIdAndUpdate(doc.id, {
      schoolId: assignment.schoolId,
      groupIds: assignment.groupIds,
      enrolledPaths: assignment.enrolledPaths,
    });
  }

  await UserModel.findByIdAndUpdate(createdUsers.get("schoolSupervisor").id, {
    schoolId: String(school.id),
    groupIds: [String(school.id), String(tahsiliClass.id)],
  });
  await UserModel.findByIdAndUpdate(createdUsers.get("groupSupervisor").id, {
    schoolId: String(school.id),
    groupIds: [String(quantClass.id)],
    managedPathIds: ["p_qudrat"],
    managedSubjectIds: ["sub_quant"],
  });

  await UserModel.findByIdAndUpdate(createdUsers.get("parentA").id, {
    linkedStudentIds: [String(createdUsers.get("studentA").id), String(createdUsers.get("studentD").id)],
  });
  await UserModel.findByIdAndUpdate(createdUsers.get("parentB").id, {
    linkedStudentIds: [String(createdUsers.get("studentB").id)],
  });

  await GroupModel.findByIdAndUpdate(school.id, {
    supervisorIds: [String(createdUsers.get("schoolSupervisor").id)],
    studentIds: studentAssignments.map((assignment) => String(createdUsers.get(assignment.key).id)),
    totalStudents: studentAssignments.length,
    totalSupervisors: 1,
  });

  await GroupModel.findByIdAndUpdate(quantClass.id, {
    supervisorIds: [String(createdUsers.get("groupSupervisor").id)],
    studentIds: [String(createdUsers.get("studentA").id), String(createdUsers.get("studentB").id), String(createdUsers.get("studentD").id)],
    totalStudents: 3,
    totalSupervisors: 1,
  });

  await GroupModel.findByIdAndUpdate(tahsiliClass.id, {
    supervisorIds: [String(createdUsers.get("schoolSupervisor").id)],
    studentIds: [String(createdUsers.get("studentC").id)],
    totalStudents: 1,
    totalSupervisors: 1,
  });

  return { admin, createdUsers, school, quantClass, tahsiliClass };
}

async function seedLessonsQuestionsQuizzes(context: {
  adminId: string;
  teacherQuantId: string;
  teacherMathId: string;
  quantClassId: string;
}) {
  const lessonPayloads = [
    {
      key: "lesson_ops_intro",
      query: { title: "ترتيب العمليات الحسابية", pathId: "p_qudrat", subjectId: "sub_quant", sectionId: "sec_quant_ops" },
      payload: {
        title: "ترتيب العمليات الحسابية",
        description: "شرح تأسيسي سريع لترتيب العمليات مع أمثلة مباشرة.",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_ops",
        type: "video",
        duration: "12 دقيقة",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_quant_add_sub"],
        order: 1,
        ownerType: "platform",
        ownerId: context.adminId,
        createdBy: context.adminId,
        approvalStatus: "approved",
        approvedBy: context.adminId,
        approvedAt: NOW,
      },
    },
    {
      key: "lesson_fractions_core",
      query: { title: "الكسور والنسب المئوية", pathId: "p_qudrat", subjectId: "sub_quant", sectionId: "sec_quant_ops" },
      payload: {
        title: "الكسور والنسب المئوية",
        description: "ربط مباشر بين الكسور والنسب المئوية والتطبيقات الشائعة.",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_ops",
        type: "video",
        duration: "16 دقيقة",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_quant_fractions"],
        order: 2,
        ownerType: "platform",
        ownerId: context.adminId,
        createdBy: context.adminId,
        approvalStatus: "approved",
        approvedBy: context.adminId,
        approvedAt: NOW,
      },
    },
    {
      key: "lesson_equations_intro",
      query: { title: "حل المعادلات خطوة بخطوة", pathId: "p_qudrat", subjectId: "sub_quant", sectionId: "sec_quant_alg" },
      payload: {
        title: "حل المعادلات خطوة بخطوة",
        description: "درس تأسيسي في المعادلات مع تحويل السؤال اللفظي إلى معادلة.",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_alg",
        type: "video",
        duration: "18 دقيقة",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_quant_equations"],
        order: 1,
        ownerType: "platform",
        ownerId: context.adminId,
        createdBy: context.adminId,
        approvalStatus: "approved",
        approvedBy: context.adminId,
        approvedAt: NOW,
      },
    },
    {
      key: "lesson_prop_patterns",
      query: { title: "التناسب الطردي والعكسي", pathId: "p_qudrat", subjectId: "sub_quant", sectionId: "sec_quant_alg" },
      payload: {
        title: "التناسب الطردي والعكسي",
        description: "فهم التناسبات الشائعة في اختبارات القدرات مع تدريبات مباشرة.",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_alg",
        type: "video",
        duration: "14 دقيقة",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_quant_proportions"],
        order: 2,
        ownerType: "platform",
        ownerId: context.adminId,
        createdBy: context.adminId,
        approvalStatus: "approved",
        approvedBy: context.adminId,
        approvedAt: NOW,
      },
    },
    {
      key: "lesson_math_functions",
      query: { title: "تمهيد الدوال والرسوم البيانية", pathId: "p_tahsili", subjectId: "sub_math", sectionId: "sec_math_functions" },
      payload: {
        title: "تمهيد الدوال والرسوم البيانية",
        description: "ربط أساسي بين نوع الدالة وشكلها البياني.",
        pathId: "p_tahsili",
        subjectId: "sub_math",
        sectionId: "sec_math_functions",
        type: "video",
        duration: "20 دقيقة",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_math_functions"],
        order: 1,
        ownerType: "platform",
        ownerId: context.adminId,
        createdBy: context.adminId,
        approvalStatus: "approved",
        approvedBy: context.adminId,
        approvedAt: NOW,
      },
    },
    {
      key: "lesson_teacher_pending",
      query: { title: "مراجعة سريعة على الكسور المركبة", pathId: "p_qudrat", subjectId: "sub_quant", sectionId: "sec_quant_ops" },
      payload: {
        title: "مراجعة سريعة على الكسور المركبة",
        description: "درس أضافه المعلم وينتظر الاعتماد قبل النشر.",
        pathId: "p_qudrat",
        subjectId: "sub_quant",
        sectionId: "sec_quant_ops",
        type: "video",
        duration: "11 دقيقة",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_quant_fractions"],
        order: 3,
        ownerType: "teacher",
        ownerId: context.teacherQuantId,
        createdBy: context.teacherQuantId,
        assignedTeacherId: context.teacherQuantId,
        approvalStatus: "pending_review",
        reviewerNotes: "بانتظار اعتماد المدير",
        revenueSharePercentage: 35,
      },
    },
    {
      key: "lesson_verbal_context",
      query: { title: "فهم السياق واستخراج الفكرة", pathId: "p_qudrat", subjectId: "sub_verbal", sectionId: "sec_verbal_reading" },
      payload: {
        title: "فهم السياق واستخراج الفكرة",
        description: "درس تأسيسي قصير في قراءة النص وتحديد الفكرة الرئيسة والمعنى من السياق.",
        pathId: "p_qudrat",
        subjectId: "sub_verbal",
        sectionId: "sec_verbal_reading",
        type: "video",
        duration: "13 دقيقة",
        videoUrl: SAMPLE_VIDEO_URL,
        skillIds: ["skill_verbal_context"],
        order: 1,
        ownerType: "platform",
        ownerId: context.adminId,
        createdBy: context.adminId,
        approvalStatus: "approved",
        approvedBy: context.adminId,
        approvedAt: NOW,
      },
    },
  ];

  const lessonDocs = new Map<string, any>();
  for (const lesson of lessonPayloads) {
    const doc = await LessonModel.findOneAndUpdate(lesson.query, lesson.payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    lessonDocs.set(lesson.key, doc);
  }

  const questionPayloads = [
    {
      id: "q_seed_quant_01",
      text: "إذا كان 18 + 7 = ؟",
      options: ["24", "25", "26", "27"],
      correctOptionIndex: 1,
      explanation: "نجمع العددين مباشرة فنحصل على 25.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_ops",
      skillIds: ["skill_quant_add_sub"],
      difficulty: "Easy",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "q_seed_quant_02",
      text: "قيمة 3/4 من 20 تساوي:",
      options: ["10", "12", "15", "16"],
      correctOptionIndex: 2,
      explanation: "نضرب 20 في 3 ثم نقسم على 4.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_ops",
      skillIds: ["skill_quant_fractions"],
      difficulty: "Medium",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "q_seed_quant_03",
      text: "إذا كان س + 5 = 17 فإن قيمة س =",
      options: ["10", "11", "12", "13"],
      correctOptionIndex: 2,
      explanation: "ننقل 5 للطرف الآخر فنحصل على س = 12.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_alg",
      skillIds: ["skill_quant_equations"],
      difficulty: "Easy",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "q_seed_quant_04",
      text: "إذا كانت 4 كتب تكلف 20 ريالًا، فكم تكلفة 10 كتب؟",
      options: ["40", "45", "50", "55"],
      correctOptionIndex: 2,
      explanation: "ثمن الكتاب الواحد 5 ريالات، إذن ثمن 10 كتب = 50.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_alg",
      skillIds: ["skill_quant_proportions"],
      difficulty: "Medium",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "q_seed_quant_05",
      text: "النسبة 2 : 5 تعادل أي كسر؟",
      options: ["2/3", "2/5", "5/2", "3/5"],
      correctOptionIndex: 1,
      explanation: "النسبة 2 إلى 5 تساوي الكسر 2/5.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_ops",
      skillIds: ["skill_quant_fractions"],
      difficulty: "Easy",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "q_seed_quant_06",
      text: "حل المعادلة 2س = 18",
      options: ["6", "8", "9", "10"],
      correctOptionIndex: 2,
      explanation: "نقسم الطرفين على 2 فيكون س = 9.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_alg",
      skillIds: ["skill_quant_equations"],
      difficulty: "Medium",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "q_seed_quant_pending",
      text: "إذا كانت 6/8 في أبسط صورة فهي:",
      options: ["1/2", "2/3", "3/4", "4/5"],
      correctOptionIndex: 2,
      explanation: "نبسط بقسمة البسط والمقام على 2.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_quant",
      sectionId: "sec_quant_ops",
      skillIds: ["skill_quant_fractions"],
      difficulty: "Easy",
      type: "mcq",
      ownerType: "teacher",
      ownerId: context.teacherQuantId,
      createdBy: context.teacherQuantId,
      assignedTeacherId: context.teacherQuantId,
      approvalStatus: "pending_review",
      reviewerNotes: "بانتظار مراجعة المدير",
      revenueSharePercentage: 35,
    },
    {
      id: "q_seed_math_01",
      text: "إذا كانت الدالة ص = 2س + 1، فإن قيمة ص عندما س = 3 تساوي:",
      options: ["5", "6", "7", "8"],
      correctOptionIndex: 2,
      explanation: "نعوض مباشرة عن س بـ 3.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_tahsili",
      subject: "sub_math",
      sectionId: "sec_math_functions",
      skillIds: ["skill_math_functions"],
      difficulty: "Medium",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "q_seed_verbal_01",
      text: "قرأ الطالب النص ثم استنتج أن الفكرة الرئيسة تدور حول:",
      options: ["تفصيل جانبي", "عنوان النص فقط", "المعنى العام للنص", "مثال واحد في الفقرة"],
      correctOptionIndex: 2,
      explanation: "الفكرة الرئيسة هي المعنى العام الذي يجمع تفاصيل النص، وليست مثالًا أو عنوانًا فقط.",
      videoUrl: SAMPLE_VIDEO_URL,
      pathId: "p_qudrat",
      subject: "sub_verbal",
      sectionId: "sec_verbal_reading",
      skillIds: ["skill_verbal_context"],
      difficulty: "Easy",
      type: "mcq",
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
  ];

  for (const question of questionPayloads) {
    await QuestionModel.findOneAndUpdate({ id: question.id }, question, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  const quizPayloads = [
    {
      id: "quiz_seed_quant_bank_ops",
      title: "بنك تدريب العمليات الحسابية",
      description: "مجموعة تدريب قصيرة على أساسيات العمليات الحسابية.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      type: "bank",
      mode: "regular",
      settings: { showExplanations: true, showAnswers: true, maxAttempts: 10, passingScore: 60, timeLimit: 20 },
      access: { type: "free", price: 0, allowedGroupIds: [] },
      questionIds: ["q_seed_quant_01", "q_seed_quant_02", "q_seed_quant_05"],
      skillIds: ["skill_quant_add_sub", "skill_quant_fractions"],
      isPublished: true,
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      createdAt: NOW,
    },
    {
      id: "quiz_seed_quant_saher_followup",
      title: "ساهر علاجي - الكسور والمعادلات",
      description: "اختبار علاجي موجه لطلاب المجموعة الضعاف في الكسور والمعادلات.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_alg",
      type: "quiz",
      mode: "saher",
      settings: { showExplanations: true, showAnswers: true, maxAttempts: 3, passingScore: 70, timeLimit: 25 },
      access: { type: "private", price: 0, allowedGroupIds: [context.quantClassId] },
      questionIds: ["q_seed_quant_02", "q_seed_quant_03", "q_seed_quant_06"],
      skillIds: ["skill_quant_fractions", "skill_quant_equations"],
      targetGroupIds: [context.quantClassId],
      targetUserIds: [],
      dueDate: new Date(NOW + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isPublished: true,
      ownerType: "teacher",
      ownerId: context.teacherQuantId,
      createdBy: context.teacherQuantId,
      assignedTeacherId: context.teacherQuantId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      revenueSharePercentage: 35,
      createdAt: NOW,
    },
    {
      id: "quiz_seed_quant_central",
      title: "اختبار مركزي - القدرات الكمي (تشغيلي)",
      description: "اختبار مركزي موجه لمجموعة المدرسة في القدرات الكمي.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      type: "quiz",
      mode: "central",
      settings: { showExplanations: true, showAnswers: true, maxAttempts: 2, passingScore: 75, timeLimit: 30 },
      access: { type: "private", price: 0, allowedGroupIds: [context.quantClassId] },
      questionIds: ["q_seed_quant_01", "q_seed_quant_02", "q_seed_quant_03", "q_seed_quant_04"],
      skillIds: ["skill_quant_add_sub", "skill_quant_fractions", "skill_quant_equations", "skill_quant_proportions"],
      targetGroupIds: [context.quantClassId],
      targetUserIds: [],
      dueDate: new Date(NOW + 5 * 24 * 60 * 60 * 1000).toISOString(),
      isPublished: true,
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      createdAt: NOW,
    },
    {
      id: "quiz_seed_math_central",
      title: "اختبار مركزي - التحصيلي رياضيات (تشغيلي)",
      description: "اختبار متابعة تحصيلي لمجموعة الرياضيات.",
      pathId: "p_tahsili",
      subjectId: "sub_math",
      sectionId: "sec_math_functions",
      type: "quiz",
      mode: "central",
      settings: { showExplanations: true, showAnswers: true, maxAttempts: 2, passingScore: 70, timeLimit: 25 },
      access: { type: "private", price: 0, allowedGroupIds: [] },
      questionIds: ["q_seed_math_01"],
      skillIds: ["skill_math_functions"],
      targetGroupIds: [],
      targetUserIds: [],
      isPublished: true,
      ownerType: "teacher",
      ownerId: context.teacherMathId,
      createdBy: context.teacherMathId,
      assignedTeacherId: context.teacherMathId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      revenueSharePercentage: 30,
      createdAt: NOW,
    },
    {
      id: "quiz_seed_pending_review",
      title: "اختبار معلم - نسب وتناسب (بانتظار الاعتماد)",
      description: "اختبار مضاف من المعلم ويظهر في طابور المراجعة.",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_alg",
      type: "quiz",
      mode: "saher",
      settings: { showExplanations: true, showAnswers: true, maxAttempts: 2, passingScore: 70, timeLimit: 15 },
      access: { type: "paid", price: 19, allowedGroupIds: [] },
      questionIds: ["q_seed_quant_pending"],
      skillIds: ["skill_quant_fractions"],
      targetGroupIds: [],
      targetUserIds: [],
      isPublished: false,
      ownerType: "teacher",
      ownerId: context.teacherQuantId,
      createdBy: context.teacherQuantId,
      assignedTeacherId: context.teacherQuantId,
      approvalStatus: "pending_review",
      reviewerNotes: "بانتظار اعتماد المدير",
      revenueSharePercentage: 35,
      createdAt: NOW,
    },
    {
      id: "quiz_seed_verbal_bank_context",
      title: "بنك تدريب اللفظي - فهم السياق",
      description: "تدريب قصير على استخراج الفكرة الرئيسة والمعنى من السياق.",
      pathId: "p_qudrat",
      subjectId: "sub_verbal",
      sectionId: "sec_verbal_reading",
      type: "bank",
      mode: "regular",
      settings: { showExplanations: true, showAnswers: true, maxAttempts: 10, passingScore: 60, timeLimit: 12 },
      access: { type: "free", price: 0, allowedGroupIds: [] },
      questionIds: ["q_seed_verbal_01"],
      skillIds: ["skill_verbal_context"],
      isPublished: true,
      showOnPlatform: true,
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      createdAt: NOW,
    },
  ];

  for (const quiz of quizPayloads) {
    await QuizModel.findOneAndUpdate({ id: quiz.id }, quiz, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  const libraryPayloads = [
    {
      id: "lib_seed_quant_summary",
      title: "ملخص القدرات الكمي - العمليات والكسور",
      size: "1.8 MB",
      downloads: 42,
      type: "pdf",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      skillIds: ["skill_quant_add_sub", "skill_quant_fractions"],
      url: SAMPLE_PDF_URL,
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "lib_seed_math_sheet",
      title: "ورقة مراجعة - الدوال والتمثيل البياني",
      size: "900 KB",
      downloads: 15,
      type: "pdf",
      pathId: "p_tahsili",
      subjectId: "sub_math",
      sectionId: "sec_math_functions",
      skillIds: ["skill_math_functions"],
      url: SAMPLE_PDF_URL,
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
    {
      id: "lib_seed_teacher_pending",
      title: "ملف تدريبي - تمارين الكسور المركبة",
      size: "650 KB",
      downloads: 0,
      type: "pdf",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      skillIds: ["skill_quant_fractions"],
      url: SAMPLE_PDF_URL,
      ownerType: "teacher",
      ownerId: context.teacherQuantId,
      createdBy: context.teacherQuantId,
      assignedTeacherId: context.teacherQuantId,
      approvalStatus: "pending_review",
      reviewerNotes: "بانتظار اعتماد المدير",
      revenueSharePercentage: 35,
    },
    {
      id: "lib_seed_verbal_context",
      title: "ملخص اللفظي - فهم السياق والفكرة الرئيسة",
      size: "750 KB",
      downloads: 18,
      type: "pdf",
      pathId: "p_qudrat",
      subjectId: "sub_verbal",
      sectionId: "sec_verbal_reading",
      skillIds: ["skill_verbal_context"],
      url: SAMPLE_PDF_URL,
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
    },
  ];

  for (const item of libraryPayloads) {
    await LibraryItemModel.findOneAndUpdate({ id: item.id }, item, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }

  await TopicModel.findOneAndUpdate(
    { id: "topic_seed_quant_main_ops" },
    {
      id: "topic_seed_quant_main_ops",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      title: "أساسيات العمليات الحسابية",
      parentId: null,
      order: 1,
      lessonIds: [String(lessonDocs.get("lesson_ops_intro").id), String(lessonDocs.get("lesson_fractions_core").id)],
      quizIds: ["quiz_seed_quant_bank_ops"],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await TopicModel.findOneAndUpdate(
    { id: "topic_seed_quant_sub_fractions" },
    {
      id: "topic_seed_quant_sub_fractions",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      title: "الكسور والنسب",
      parentId: "topic_seed_quant_main_ops",
      order: 1,
      lessonIds: [String(lessonDocs.get("lesson_fractions_core").id)],
      quizIds: ["quiz_seed_quant_bank_ops"],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await TopicModel.findOneAndUpdate(
    { id: "topic_seed_quant_main_alg" },
    {
      id: "topic_seed_quant_main_alg",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_alg",
      title: "مدخل الجبر والمعادلات",
      parentId: null,
      order: 2,
      lessonIds: [String(lessonDocs.get("lesson_equations_intro").id), String(lessonDocs.get("lesson_prop_patterns").id)],
      quizIds: ["quiz_seed_quant_saher_followup"],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await TopicModel.findOneAndUpdate(
    { id: "topic_seed_verbal_context" },
    {
      id: "topic_seed_verbal_context",
      pathId: "p_qudrat",
      subjectId: "sub_verbal",
      sectionId: "sec_verbal_reading",
      title: "فهم السياق والفكرة الرئيسة",
      parentId: null,
      order: 1,
      showOnPlatform: true,
      lessonIds: [String(lessonDocs.get("lesson_verbal_context").id)],
      quizIds: ["quiz_seed_verbal_bank_context"],
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const quantCourseModules = [
    {
      title: "الوحدة الأولى: تأسيس العمليات",
      order: 1,
      lessons: [
        {
          id: String(lessonDocs.get("lesson_ops_intro").id),
          title: "ترتيب العمليات الحسابية",
          type: "video",
          duration: "12 دقيقة",
          videoUrl: SAMPLE_VIDEO_URL,
          pathId: "p_qudrat",
          subjectId: "sub_quant",
          sectionId: "sec_quant_ops",
          skillIds: ["skill_quant_add_sub"],
          order: 1,
        },
        {
          id: String(lessonDocs.get("lesson_fractions_core").id),
          title: "الكسور والنسب المئوية",
          type: "video",
          duration: "16 دقيقة",
          videoUrl: SAMPLE_VIDEO_URL,
          pathId: "p_qudrat",
          subjectId: "sub_quant",
          sectionId: "sec_quant_ops",
          skillIds: ["skill_quant_fractions"],
          quizId: "quiz_seed_quant_bank_ops",
          order: 2,
        },
      ],
    },
    {
      title: "الوحدة الثانية: الجبر التطبيقي",
      order: 2,
      lessons: [
        {
          id: String(lessonDocs.get("lesson_equations_intro").id),
          title: "حل المعادلات خطوة بخطوة",
          type: "video",
          duration: "18 دقيقة",
          videoUrl: SAMPLE_VIDEO_URL,
          pathId: "p_qudrat",
          subjectId: "sub_quant",
          sectionId: "sec_quant_alg",
          skillIds: ["skill_quant_equations"],
          order: 1,
        },
        {
          id: String(lessonDocs.get("lesson_prop_patterns").id),
          title: "التناسب الطردي والعكسي",
          type: "video",
          duration: "14 دقيقة",
          videoUrl: SAMPLE_VIDEO_URL,
          pathId: "p_qudrat",
          subjectId: "sub_quant",
          sectionId: "sec_quant_alg",
          skillIds: ["skill_quant_proportions"],
          quizId: "quiz_seed_quant_central",
          order: 2,
        },
      ],
    },
  ];

  await CourseModel.findByIdAndUpdate(
    "course_seed_quant_mastery",
    {
      _id: "course_seed_quant_mastery",
      title: "التأسيس الذكي في القدرات الكمي",
      thumbnail: "https://picsum.photos/seed/quant-course/800/500",
      instructor: "فريق منصة المئة",
      price: 149,
      currency: "SAR",
      duration: 8,
      level: "Beginner",
      rating: 4.8,
      progress: 0,
      category: "p_qudrat",
      subject: "sub_quant",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      features: ["فيديوهات تأسيس", "اختبارات علاجية", "ملفات مراجعة", "تقرير مهارات"],
      description: "دورة عملية تبدأ بالتأسيس ثم التدريب ثم الاختبارات العلاجية في القدرات الكمي.",
      instructorBio: "محتوى تأسيسي معتمد من إدارة المنصة.",
      modules: quantCourseModules,
      isPublished: true,
      isPackage: false,
      skills: ["skill_quant_add_sub", "skill_quant_fractions", "skill_quant_equations", "skill_quant_proportions"],
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      certificateEnabled: true,
      dripContentEnabled: false,
      studentCount: 38,
      weeksCount: 4,
      previewVideoUrl: SAMPLE_VIDEO_URL,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await CourseModel.findByIdAndUpdate(
    "course_seed_math_mastery",
    {
      _id: "course_seed_math_mastery",
      title: "التحصيلي رياضيات - أساسيات الدوال",
      thumbnail: "https://picsum.photos/seed/math-course/800/500",
      instructor: "أ. خالد الرياضيات",
      price: 119,
      currency: "SAR",
      duration: 6,
      level: "Intermediate",
      rating: 4.6,
      progress: 0,
      category: "p_tahsili",
      subject: "sub_math",
      pathId: "p_tahsili",
      subjectId: "sub_math",
      sectionId: "sec_math_functions",
      features: ["تمهيد نظري", "أمثلة محلولة", "اختبار متابعة"],
      description: "دورة مركزة على فهم الدوال والرسوم البيانية في التحصيلي.",
      modules: [
        {
          title: "الوحدة الأولى",
          order: 1,
          lessons: [
            {
              id: String(lessonDocs.get("lesson_math_functions").id),
              title: "تمهيد الدوال والرسوم البيانية",
              type: "video",
              duration: "20 دقيقة",
              videoUrl: SAMPLE_VIDEO_URL,
              pathId: "p_tahsili",
              subjectId: "sub_math",
              sectionId: "sec_math_functions",
              skillIds: ["skill_math_functions"],
              order: 1,
            },
          ],
        },
      ],
      isPublished: true,
      isPackage: false,
      skills: ["skill_math_functions"],
      ownerType: "teacher",
      ownerId: context.teacherMathId,
      createdBy: context.teacherMathId,
      assignedTeacherId: context.teacherMathId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      revenueSharePercentage: 30,
      certificateEnabled: true,
      studentCount: 17,
      weeksCount: 3,
      previewVideoUrl: SAMPLE_VIDEO_URL,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await CourseModel.findByIdAndUpdate(
    "course_seed_teacher_pending",
    {
      _id: "course_seed_teacher_pending",
      title: "ورشة المعلم - مراجعة الكسور المركبة",
      thumbnail: "https://picsum.photos/seed/pending-course/800/500",
      instructor: "أ. ريم الكمي",
      price: 89,
      currency: "SAR",
      duration: 3,
      level: "Intermediate",
      rating: 0,
      progress: 0,
      category: "p_qudrat",
      subject: "sub_quant",
      pathId: "p_qudrat",
      subjectId: "sub_quant",
      sectionId: "sec_quant_ops",
      features: ["قيد المراجعة", "محتوى مضاف من المعلم"],
      description: "دورة أضافها المعلم وتنتظر موافقة المدير قبل الظهور العام.",
      modules: [
        {
          title: "الوحدة الأولى",
          order: 1,
          lessons: [
            {
              id: String(lessonDocs.get("lesson_teacher_pending").id),
              title: "مراجعة سريعة على الكسور المركبة",
              type: "video",
              duration: "11 دقيقة",
              videoUrl: SAMPLE_VIDEO_URL,
              pathId: "p_qudrat",
              subjectId: "sub_quant",
              sectionId: "sec_quant_ops",
              skillIds: ["skill_quant_fractions"],
              order: 1,
            },
          ],
        },
      ],
      isPublished: false,
      isPackage: false,
      skills: ["skill_quant_fractions"],
      ownerType: "teacher",
      ownerId: context.teacherQuantId,
      createdBy: context.teacherQuantId,
      assignedTeacherId: context.teacherQuantId,
      approvalStatus: "pending_review",
      reviewerNotes: "ينتظر موافقة المدير",
      revenueSharePercentage: 35,
      previewVideoUrl: SAMPLE_VIDEO_URL,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await CourseModel.findByIdAndUpdate(
    "course_seed_verbal_context",
    {
      _id: "course_seed_verbal_context",
      title: "التأسيس اللفظي - فهم السياق",
      thumbnail: "https://picsum.photos/seed/verbal-course/800/500",
      instructor: "فريق منصة المئة",
      price: 99,
      currency: "SAR",
      duration: 4,
      level: "Beginner",
      rating: 4.7,
      progress: 0,
      category: "p_qudrat",
      subject: "sub_verbal",
      pathId: "p_qudrat",
      subjectId: "sub_verbal",
      sectionId: "sec_verbal_reading",
      features: ["فيديو تأسيسي", "تدريب قصير", "ملف مراجعة", "ربط بالمهارة"],
      description: "دورة قصيرة لتأسيس الطالب في فهم السياق واستخراج الفكرة الرئيسة داخل النصوص.",
      modules: [
        {
          title: "الوحدة الأولى: فهم النص",
          order: 1,
          lessons: [
            {
              id: String(lessonDocs.get("lesson_verbal_context").id),
              title: "فهم السياق واستخراج الفكرة",
              type: "video",
              duration: "13 دقيقة",
              videoUrl: SAMPLE_VIDEO_URL,
              pathId: "p_qudrat",
              subjectId: "sub_verbal",
              sectionId: "sec_verbal_reading",
              skillIds: ["skill_verbal_context"],
              quizId: "quiz_seed_verbal_bank_context",
              order: 1,
            },
          ],
        },
      ],
      isPublished: true,
      isPackage: false,
      skills: ["skill_verbal_context"],
      ownerType: "platform",
      ownerId: context.adminId,
      createdBy: context.adminId,
      approvalStatus: "approved",
      approvedBy: context.adminId,
      approvedAt: NOW,
      certificateEnabled: true,
      studentCount: 22,
      weeksCount: 2,
      previewVideoUrl: SAMPLE_VIDEO_URL,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await SkillModel.findByIdAndUpdate("skill_quant_add_sub", {
    lessonIds: [String(lessonDocs.get("lesson_ops_intro").id)],
    questionIds: ["q_seed_quant_01"],
  });
  await SkillModel.findByIdAndUpdate("skill_quant_fractions", {
    lessonIds: [String(lessonDocs.get("lesson_fractions_core").id), String(lessonDocs.get("lesson_teacher_pending").id)],
    questionIds: ["q_seed_quant_02", "q_seed_quant_05", "q_seed_quant_pending"],
  });
  await SkillModel.findByIdAndUpdate("skill_quant_equations", {
    lessonIds: [String(lessonDocs.get("lesson_equations_intro").id)],
    questionIds: ["q_seed_quant_03", "q_seed_quant_06"],
  });
  await SkillModel.findByIdAndUpdate("skill_quant_proportions", {
    lessonIds: [String(lessonDocs.get("lesson_prop_patterns").id)],
    questionIds: ["q_seed_quant_04"],
  });
  await SkillModel.findByIdAndUpdate("skill_math_functions", {
    lessonIds: [String(lessonDocs.get("lesson_math_functions").id)],
    questionIds: ["q_seed_math_01"],
  });
  await SkillModel.findByIdAndUpdate("skill_verbal_context", {
    lessonIds: [String(lessonDocs.get("lesson_verbal_context").id)],
    questionIds: ["q_seed_verbal_01"],
  });

  return {
    quantCourseId: "course_seed_quant_mastery",
    mathCourseId: "course_seed_math_mastery",
    quantQuizIds: ["quiz_seed_quant_bank_ops", "quiz_seed_quant_saher_followup", "quiz_seed_quant_central"],
    mathQuizId: "quiz_seed_math_central",
  };
}

async function seedCommercialAndResults(context: {
  adminId: string;
  schoolId: string;
  quantClassId: string;
  quantCourseId: string;
  mathCourseId: string;
  quantQuizIds: string[];
  mathQuizId: string;
  studentIds: Record<string, string>;
}) {
  await B2BPackageModel.findOneAndUpdate(
    { id: "pkg_seed_school_quant_full" },
    {
      id: "pkg_seed_school_quant_full",
      schoolId: context.schoolId,
      name: "باقة مدرسة الريادة - القدرات الكمي الشاملة",
      courseIds: [context.quantCourseId],
      contentTypes: ["courses", "foundation", "banks", "tests", "library"],
      pathIds: ["p_qudrat"],
      subjectIds: ["sub_quant"],
      type: "free_access",
      maxStudents: 50,
      status: "active",
      createdAt: NOW,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await B2BPackageModel.findOneAndUpdate(
    { id: "pkg_seed_school_math_tests" },
    {
      id: "pkg_seed_school_math_tests",
      schoolId: context.schoolId,
      name: "باقة مدرسة الريادة - اختبارات التحصيلي رياضيات",
      courseIds: [context.mathCourseId],
      contentTypes: ["tests", "library"],
      pathIds: ["p_tahsili"],
      subjectIds: ["sub_math"],
      type: "free_access",
      maxStudents: 20,
      status: "active",
      createdAt: NOW,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await AccessCodeModel.findOneAndUpdate(
    { code: "RIYADA-QUANT-2026" },
    {
      id: "code_seed_riyad_quant",
      code: "RIYADA-QUANT-2026",
      schoolId: context.schoolId,
      packageId: "pkg_seed_school_quant_full",
      maxUses: 50,
      currentUses: 0,
      expiresAt: NOW + 180 * 24 * 60 * 60 * 1000,
      createdAt: NOW,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await GroupModel.findByIdAndUpdate(context.quantClassId, {
    courseIds: [context.quantCourseId],
    totalCourses: 1,
  });

  const studentAPurchasedPackages = ["pkg_seed_school_quant_full"];
  await UserModel.findByIdAndUpdate(context.studentIds.studentA, {
    subscription: {
      plan: "premium",
      purchasedCourses: [context.quantCourseId],
      purchasedPackages: studentAPurchasedPackages,
    },
    enrolledCourses: [context.quantCourseId],
    favorites: ["q_seed_quant_02"],
    reviewLater: ["q_seed_quant_06"],
  });

  await UserModel.findByIdAndUpdate(context.studentIds.studentB, {
    subscription: {
      plan: "premium",
      purchasedCourses: [context.quantCourseId],
      purchasedPackages: ["pkg_seed_school_quant_full"],
    },
    enrolledCourses: [context.quantCourseId],
    favorites: ["q_seed_quant_03"],
    reviewLater: ["q_seed_quant_02"],
  });

  await UserModel.findByIdAndUpdate(context.studentIds.studentC, {
    subscription: {
      plan: "premium",
      purchasedCourses: [context.mathCourseId],
      purchasedPackages: ["pkg_seed_school_math_tests"],
    },
    enrolledCourses: [context.mathCourseId],
  });

  await UserModel.findByIdAndUpdate(context.studentIds.studentD, {
    subscription: {
      plan: "free",
      purchasedCourses: [],
      purchasedPackages: [],
    },
    enrolledCourses: [],
  });

  await QuizResultModel.deleteMany({
    quizId: { $in: [...context.quantQuizIds, context.mathQuizId] },
    userId: { $in: Object.values(context.studentIds) },
  });

  const results = [
    {
      userId: context.studentIds.studentA,
      quizId: "quiz_seed_quant_central",
      quizTitle: "اختبار مركزي - القدرات الكمي (تشغيلي)",
      score: 58,
      totalQuestions: 4,
      correctAnswers: 2,
      wrongAnswers: 2,
      unanswered: 0,
      timeSpent: "00:18:20",
      date: new Date(NOW).toISOString(),
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
    },
    {
      userId: context.studentIds.studentB,
      quizId: "quiz_seed_quant_saher_followup",
      quizTitle: "ساهر علاجي - الكسور والمعادلات",
      score: 71,
      totalQuestions: 3,
      correctAnswers: 2,
      wrongAnswers: 1,
      unanswered: 0,
      timeSpent: "00:12:11",
      date: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
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
    },
    {
      userId: context.studentIds.studentC,
      quizId: context.mathQuizId,
      quizTitle: "اختبار مركزي - التحصيلي رياضيات (تشغيلي)",
      score: 67,
      totalQuestions: 1,
      correctAnswers: 0,
      wrongAnswers: 1,
      unanswered: 0,
      timeSpent: "00:09:05",
      date: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
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
    },
  ];

  await QuizResultModel.insertMany(results);

  await ActivityModel.deleteMany({
    userId: { $in: Object.values(context.studentIds) },
    title: { $in: ["إكمال درس ترتيب العمليات", "اختبار علاجي على الكسور", "حجز جلسة دعم فردية"] },
  });

  await ActivityModel.insertMany([
    {
      userId: context.studentIds.studentA,
      type: "lesson_complete",
      title: "إكمال درس ترتيب العمليات",
      date: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString(),
      link: `/course/${context.quantCourseId}`,
    },
    {
      userId: context.studentIds.studentA,
      type: "quiz_complete",
      title: "اختبار علاجي على الكسور",
      date: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(),
      link: "/quizzes",
    },
    {
      userId: context.studentIds.studentB,
      type: "session_booked",
      title: "حجز جلسة دعم فردية",
      date: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
      link: "/book-session",
    },
  ]);
}

async function run() {
  await connectToDatabase();

  try {
    await seedTaxonomy();

    const usersAndGroups = await seedUsersAndGroups();
    const adminId = String(usersAndGroups.admin.id);
    const teacherQuantId = String(usersAndGroups.createdUsers.get("teacherQuant").id);
    const teacherMathId = String(usersAndGroups.createdUsers.get("teacherMath").id);

    const seededContent = await seedLessonsQuestionsQuizzes({
      adminId,
      teacherQuantId,
      teacherMathId,
      quantClassId: String(usersAndGroups.quantClass.id),
    });

    await seedCommercialAndResults({
      adminId,
      schoolId: String(usersAndGroups.school.id),
      quantClassId: String(usersAndGroups.quantClass.id),
      quantCourseId: seededContent.quantCourseId,
      mathCourseId: seededContent.mathCourseId,
      quantQuizIds: seededContent.quantQuizIds,
      mathQuizId: seededContent.mathQuizId,
      studentIds: {
        studentA: String(usersAndGroups.createdUsers.get("studentA").id),
        studentB: String(usersAndGroups.createdUsers.get("studentB").id),
        studentC: String(usersAndGroups.createdUsers.get("studentC").id),
        studentD: String(usersAndGroups.createdUsers.get("studentD").id),
      },
    });

    const summary = {
      lessons: await LessonModel.countDocuments({ subjectId: { $in: ["sub_quant", "sub_math"] } }),
      questions: await QuestionModel.countDocuments({ subject: { $in: ["sub_quant", "sub_math"] } }),
      quizzes: await QuizModel.countDocuments({ subjectId: { $in: ["sub_quant", "sub_math"] } }),
      topics: await TopicModel.countDocuments({ subjectId: "sub_quant" }),
      libraryItems: await LibraryItemModel.countDocuments({ subjectId: { $in: ["sub_quant", "sub_math"] } }),
      courses: await CourseModel.countDocuments({ _id: { $in: ["course_seed_quant_mastery", "course_seed_math_mastery", "course_seed_teacher_pending"] } }),
      groups: await GroupModel.countDocuments({ name: /تشغيل/ }),
      users: await UserModel.countDocuments({ email: /@almeaa\.local$/ }),
      packages: await B2BPackageModel.countDocuments({ id: { $in: ["pkg_seed_school_quant_full", "pkg_seed_school_math_tests"] } }),
      quizResults: await QuizResultModel.countDocuments({ quizId: { $in: ["quiz_seed_quant_central", "quiz_seed_quant_saher_followup", "quiz_seed_math_central"] } }),
    };

    console.log("Operational scenario seeded successfully");
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      JSON.stringify(
        {
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
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error("Failed to seed operational scenario", error);
  process.exit(1);
});

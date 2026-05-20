import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { db } from "../db/connection.js";
import { users, paths, levels, subjects, sections, skills, courses, lessons, topics, questions, quizzes, quizResults, questionAttempts, skillProgress, b2bPackages, accessCodes, paymentRequests, paymentSettings, studyPlans, groups, libraryItems, homepageSettings, activities } from "../db/schema/index.js";
import { UserModel } from "../models/User.js";
import { PathModel } from "../models/Path.js";
import { LevelModel } from "../models/Level.js";
import { SubjectModel } from "../models/Subject.js";
import { SectionModel } from "../models/Section.js";
import { SkillModel } from "../models/Skill.js";
import { CourseModel } from "../models/Course.js";
import { LessonModel } from "../models/Lesson.js";
import { TopicModel } from "../models/Topic.js";
import { QuestionModel } from "../models/Question.js";
import { QuizModel } from "../models/Quiz.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { QuestionAttemptModel } from "../models/QuestionAttempt.js";
import { SkillProgressModel } from "../models/SkillProgress.js";
import { B2BPackageModel } from "../models/B2BPackage.js";
import { AccessCodeModel } from "../models/AccessCode.js";
import { PaymentRequestModel } from "../models/PaymentRequest.js";
import { PaymentSettingsModel } from "../models/PaymentSettings.js";
import { StudyPlanModel } from "../models/StudyPlan.js";
import { GroupModel } from "../models/Group.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { HomepageSettingsModel } from "../models/HomepageSettings.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/the-hundred";

async function migrate() {
  console.log("Connecting to MongoDB:", MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected\n");

  const stats = { users: 0, paths: 0, levels: 0, subjects: 0, sections: 0, skills: 0, courses: 0, lessons: 0, topics: 0, questions: 0, quizzes: 0, quizResults: 0, questionAttempts: 0, skillProgress: 0, b2bPackages: 0, accessCodes: 0, paymentRequests: 0, paymentSettings: 0, studyPlans: 0, groups: 0, libraryItems: 0, homepageSettings: 0, activities: 0 };

  // ---- Users ----
  const mongoUsers = await UserModel.find().lean();
  for (const u of mongoUsers) {
    try {
      await db.insert(users).values({
        id: String(u._id || u.id),
        name: u.name || "",
        email: (u.email || "").toLowerCase(),
        passwordHash: u.passwordHash || await bcrypt.hash("changeme123", 10),
        avatar: u.avatar || "",
        role: u.role || "student",
        points: u.points || 0,
        badges: u.badges || [],
        subscriptionPlan: u.subscription?.plan || "free",
        subscriptionExpiresAt: u.subscription?.expiresAt ? new Date(u.subscription.expiresAt) : null,
        purchasedCourses: u.subscription?.purchasedCourses || [],
        purchasedPackages: u.subscription?.purchasedPackages || [],
        isActive: u.isActive !== false,
        schoolId: u.schoolId || null,
        groupIds: u.groupIds || [],
        linkedStudentIds: u.linkedStudentIds || [],
        managedPathIds: u.managedPathIds || [],
        managedSubjectIds: u.managedSubjectIds || [],
        enrolledCourses: u.enrolledCourses || [],
        enrolledPaths: u.enrolledPaths || [],
        completedLessons: u.completedLessons || [],
        favorites: u.favorites || [],
        reviewLater: u.reviewLater || [],
      } as any).onConflictDoNothing();
      stats.users++;
    } catch (err: any) {
      if (!err.message?.includes("duplicate key")) {
        console.error(`User ${u.email} error:`, err.message);
      }
    }
  }
  console.log(`Migrated ${stats.users} users`);

  // ---- Paths ----
  const mongoPaths = await PathModel.find().lean();
  for (const p of mongoPaths) {
    try {
      await db.insert(paths).values({
        id: String(p._id || p.id),
        name: p.name || "",
        color: p.color || null,
        icon: p.icon || null,
        iconUrl: p.iconUrl || null,
        iconStyle: p.iconStyle || null,
        showInNavbar: p.showInNavbar !== false ? 1 : 0,
        showInHome: p.showInHome !== false ? 1 : 0,
        isActive: p.isActive !== false ? 1 : 0,
        parentPathId: p.parentPathId || null,
        description: p.description || null,
      } as any).onConflictDoNothing();
      stats.paths++;
    } catch {}
  }

  // ---- Levels ----
  const mongoLevels = await LevelModel.find().lean();
  for (const l of mongoLevels) {
    try {
      await db.insert(levels).values({
        id: String(l._id || l.id),
        pathId: String(l.pathId || ""),
        name: l.name || "",
      } as any).onConflictDoNothing();
      stats.levels++;
    } catch {}
  }

  // ---- Subjects ----
  const mongoSubjects = await SubjectModel.find().lean();
  for (const s of mongoSubjects) {
    try {
      await db.insert(subjects).values({
        id: String(s._id || s.id),
        pathId: String(s.pathId || ""),
        levelId: s.levelId || null,
        name: s.name || "",
        color: s.color || null,
        icon: s.icon || null,
        iconUrl: s.iconUrl || null,
        iconStyle: s.iconStyle || null,
        settings: s.settings || {},
      } as any).onConflictDoNothing();
      stats.subjects++;
    } catch {}
  }

  // ---- Sections ----
  const mongoSections = await SectionModel.find().lean();
  for (const s of mongoSections) {
    try {
      await db.insert(sections).values({
        id: String(s._id || s.id),
        subjectId: String(s.subjectId || ""),
        name: s.name || "",
      } as any).onConflictDoNothing();
      stats.sections++;
    } catch {}
  }

  // ---- Skills ----
  const mongoSkills = await SkillModel.find().lean();
  for (const s of mongoSkills) {
    try {
      await db.insert(skills).values({
        id: String(s._id || s.id),
        name: s.name || "",
        pathId: String(s.pathId || ""),
        subjectId: String(s.subjectId || ""),
        sectionId: String(s.sectionId || ""),
        description: s.description || "",
        lessonIds: s.lessonIds || [],
        questionIds: s.questionIds || [],
      } as any).onConflictDoNothing();
      stats.skills++;
    } catch {}
  }

  // ---- Courses ----
  const mongoCourses = await CourseModel.find().lean();
  for (const c of mongoCourses) {
    try {
      await db.insert(courses).values({
        id: String(c._id || c.id),
        title: c.title || "",
        thumbnail: c.thumbnail || "",
        instructor: c.instructor || "",
        price: c.price || 0,
        currency: c.currency || "SAR",
        duration: c.duration || 0,
        level: c.level || "Beginner",
        rating: c.rating || 0,
        progress: c.progress || 0,
        category: c.category || "",
        subject: c.subject || "",
        pathId: c.pathId || null,
        subjectId: c.subjectId || null,
        sectionId: c.sectionId || null,
        features: c.features || [],
        description: c.description || "",
        instructorBio: c.instructorBio || "",
        modules: c.modules || [],
        isPublished: c.isPublished || false,
        showOnPlatform: c.showOnPlatform !== false,
        isPackage: c.isPackage || false,
        packageType: c.packageType || null,
        packageContentTypes: c.packageContentTypes || null,
        originalPrice: c.originalPrice || null,
        includedCourses: c.includedCourses || [],
        prerequisiteCourseIds: c.prerequisiteCourseIds || [],
        dripContentEnabled: c.dripContentEnabled || false,
        certificateEnabled: c.certificateEnabled || false,
        skills: c.skills || [],
        studentCount: c.studentCount || null,
        weeksCount: c.weeksCount || null,
        previewVideoUrl: c.previewVideoUrl || null,
        files: c.files || [],
        qa: c.qa || [],
        ownerType: c.ownerType || "platform",
        ownerId: c.ownerId || "",
        createdBy: c.createdBy || "",
        assignedTeacherId: c.assignedTeacherId || "",
        approvalStatus: c.approvalStatus || "draft",
        approvedBy: c.approvedBy || "",
        approvedAt: c.approvedAt || null,
        reviewerNotes: c.reviewerNotes || "",
        revenueSharePercentage: c.revenueSharePercentage || null,
      } as any).onConflictDoNothing();
      stats.courses++;
    } catch {}
  }

  // ---- Lessons ----
  const mongoLessons = await LessonModel.find().lean();
  for (const l of mongoLessons) {
    try {
      await db.insert(lessons).values({
        id: String(l._id || l.id),
        title: l.title || "",
        description: l.description || "",
        pathId: l.pathId || null,
        subjectId: l.subjectId || null,
        sectionId: l.sectionId || null,
        type: l.type || "text",
        duration: l.duration || "",
        content: l.content || "",
        videoUrl: l.videoUrl || "",
        fileUrl: l.fileUrl || "",
        meetingUrl: l.meetingUrl || "",
        meetingDate: l.meetingDate || "",
        recordingUrl: l.recordingUrl || "",
        joinInstructions: l.joinInstructions || "",
        showRecordingOnPlatform: l.showRecordingOnPlatform || false,
        showOnPlatform: l.showOnPlatform !== false,
        quizId: l.quizId || null,
        order: l.order || 0,
        isLocked: l.isLocked || false,
        skillIds: l.skillIds || [],
        ownerType: l.ownerType || "platform",
        ownerId: l.ownerId || "",
        createdBy: l.createdBy || "",
        assignedTeacherId: l.assignedTeacherId || "",
        approvalStatus: l.approvalStatus || "draft",
        approvedBy: l.approvedBy || "",
        approvedAt: l.approvedAt || null,
        reviewerNotes: l.reviewerNotes || "",
        revenueSharePercentage: l.revenueSharePercentage || null,
      } as any).onConflictDoNothing();
      stats.lessons++;
    } catch {}
  }

  // ---- Topics ----
  const mongoTopics = await TopicModel.find().lean();
  for (const t of mongoTopics) {
    try {
      await db.insert(topics).values({
        id: String(t._id || t.id),
        pathId: String(t.pathId || ""),
        subjectId: String(t.subjectId || ""),
        sectionId: t.sectionId || null,
        title: t.title || "",
        parentId: t.parentId || null,
        order: t.order || 0,
        showOnPlatform: t.showOnPlatform !== false,
        isLocked: t.isLocked || false,
        lessonIds: t.lessonIds || [],
        quizIds: t.quizIds || [],
      } as any).onConflictDoNothing();
      stats.topics++;
    } catch {}
  }

  // ---- Questions ----
  const mongoQuestions = await QuestionModel.find().lean();
  for (const q of mongoQuestions) {
    try {
      await db.insert(questions).values({
        id: String(q._id || q.id),
        text: q.text || "",
        options: q.options || [],
        correctOptionIndex: q.correctOptionIndex || 0,
        explanation: q.explanation || "",
        videoUrl: q.videoUrl || "",
        imageUrl: q.imageUrl || "",
        skillIds: q.skillIds || [],
        pathId: q.pathId || null,
        subject: q.subject || "",
        sectionId: q.sectionId || null,
        difficulty: q.difficulty || "Medium",
        type: q.type || "mcq",
        ownerType: q.ownerType || "platform",
        ownerId: q.ownerId || "",
        createdBy: q.createdBy || "",
        assignedTeacherId: q.assignedTeacherId || "",
        approvalStatus: q.approvalStatus || "draft",
        approvedBy: q.approvedBy || "",
        approvedAt: q.approvedAt || null,
        reviewerNotes: q.reviewerNotes || "",
        revenueSharePercentage: q.revenueSharePercentage || null,
      } as any).onConflictDoNothing();
      stats.questions++;
    } catch {}
  }

  // ---- Quizzes ----
  const mongoQuizzes = await QuizModel.find().lean();
  for (const q of mongoQuizzes) {
    try {
      await db.insert(quizzes).values({
        id: String(q._id || q.id),
        title: q.title || "",
        description: q.description || "",
        pathId: String(q.pathId || ""),
        subjectId: String(q.subjectId || ""),
        sectionId: q.sectionId || null,
        type: q.type || "quiz",
        mode: q.mode || "regular",
        settings: q.settings || {},
        accessType: q.access?.type || "free",
        accessPrice: q.access?.price || 0,
        accessAllowedGroupIds: q.access?.allowedGroupIds || [],
        questionIds: q.questionIds || [],
        skillIds: q.skillIds || [],
        targetGroupIds: q.targetGroupIds || [],
        targetUserIds: q.targetUserIds || [],
        dueDate: q.dueDate || null,
        isPublished: q.isPublished || false,
        showOnPlatform: q.showOnPlatform !== false,
        ownerType: q.ownerType || "platform",
        ownerId: q.ownerId || "",
        createdBy: q.createdBy || "",
        assignedTeacherId: q.assignedTeacherId || "",
        approvalStatus: q.approvalStatus || "draft",
        approvedBy: q.approvedBy || "",
        approvedAt: q.approvedAt || null,
        reviewerNotes: q.reviewerNotes || "",
        revenueSharePercentage: q.revenueSharePercentage || null,
      } as any).onConflictDoNothing();
      stats.quizzes++;
    } catch {}
  }

  // ---- Quiz Results ----
  const mongoResults = await QuizResultModel.find().lean();
  for (const r of mongoResults) {
    try {
      await db.insert(quizResults).values({
        id: String(r._id || r.id),
        userId: String(r.userId || ""),
        quizId: String(r.quizId || ""),
        quizTitle: r.quizTitle || "",
        score: r.score || 0,
        totalQuestions: r.totalQuestions || 0,
        correctAnswers: r.correctAnswers || 0,
        wrongAnswers: r.wrongAnswers || 0,
        unanswered: r.unanswered || 0,
        timeSpent: r.timeSpent || "",
        date: r.date || "",
        skillsAnalysis: r.skillsAnalysis || [],
        questionReview: r.questionReview || [],
      } as any).onConflictDoNothing();
      stats.quizResults++;
    } catch {}
  }

  // ---- Question Attempts ----
  const mongoAttempts = await QuestionAttemptModel.find().lean();
  for (const a of mongoAttempts) {
    try {
      await db.insert(questionAttempts).values({
        id: String(a._id || a.id),
        userId: String(a.userId || ""),
        questionId: String(a.questionId || ""),
        selectedOptionIndex: a.selectedOptionIndex ?? -1,
        isCorrect: a.isCorrect || false,
        timeSpentSeconds: a.timeSpentSeconds || 0,
        date: a.date || "",
        pathId: a.pathId || "",
        subjectId: a.subjectId || "",
        sectionId: a.sectionId || "",
        skillIds: a.skillIds || [],
      } as any).onConflictDoNothing();
      stats.questionAttempts++;
    } catch {}
  }

  // ---- Skill Progress ----
  const mongoProgress = await SkillProgressModel.find().lean();
  for (const p of mongoProgress) {
    try {
      await db.insert(skillProgress).values({
        id: String(p._id || p.id),
        userId: String(p.userId || ""),
        skillId: String(p.skillId || ""),
        skill: p.skill || "",
        pathId: p.pathId || "",
        subjectId: p.subjectId || "",
        sectionId: p.sectionId || "",
        mastery: p.mastery || 0,
        status: p.status || "weak",
        attempts: p.attempts || 0,
        lastQuizId: p.lastQuizId || "",
        lastQuizTitle: p.lastQuizTitle || "",
        recommendedAction: p.recommendedAction || "",
      } as any).onConflictDoNothing();
      stats.skillProgress++;
    } catch {}
  }

  // ---- Groups ----
  const mongoGroups = await GroupModel.find().lean();
  for (const g of mongoGroups) {
    try {
      await db.insert(groups).values({
        id: String(g._id || g.id),
        name: g.name || "",
        type: g.type || "CLASS",
        parentId: g.parentId || null,
        ownerId: String(g.ownerId || ""),
        supervisorIds: g.supervisorIds || [],
        studentIds: g.studentIds || [],
        courseIds: g.courseIds || [],
        description: g.description || "",
        location: g.location || "",
        settings: g.settings || {},
      } as any).onConflictDoNothing();
      stats.groups++;
    } catch {}
  }

  // ---- B2B Packages ----
  const mongoPackages = await B2BPackageModel.find().lean();
  for (const p of mongoPackages) {
    try {
      await db.insert(b2bPackages).values({
        id: String(p._id || p.id),
        schoolId: String(p.schoolId || ""),
        name: p.name || "",
        courseIds: p.courseIds || [],
        contentTypes: p.contentTypes || ["all"],
        pathIds: p.pathIds || [],
        subjectIds: p.subjectIds || [],
        type: p.type || "free_access",
        discountPercentage: p.discountPercentage || null,
        maxStudents: p.maxStudents || 0,
        status: p.status || "active",
        createdAt: p.createdAt || 0,
      } as any).onConflictDoNothing();
      stats.b2bPackages++;
    } catch {}
  }

  // ---- Access Codes ----
  const mongoCodes = await AccessCodeModel.find().lean();
  for (const c of mongoCodes) {
    try {
      await db.insert(accessCodes).values({
        id: String(c._id || c.id),
        code: c.code || "",
        schoolId: String(c.schoolId || ""),
        packageId: String(c.packageId || ""),
        maxUses: c.maxUses || 1,
        currentUses: c.currentUses || 0,
        expiresAt: c.expiresAt || 0,
        createdAt: c.createdAt || 0,
      } as any).onConflictDoNothing();
      stats.accessCodes++;
    } catch {}
  }

  // ---- Payment Requests ----
  const mongoPayments = await PaymentRequestModel.find().lean();
  for (const p of mongoPayments) {
    try {
      await db.insert(paymentRequests).values({
        id: String(p._id || p.id),
        userId: String(p.userId || ""),
        userName: p.userName || "",
        userEmail: p.userEmail || "",
        itemType: p.itemType || "course",
        itemId: String(p.itemId || ""),
        itemName: p.itemName || "",
        packageId: p.packageId || "",
        includedCourseIds: p.includedCourseIds || [],
        amount: p.amount || 0,
        currency: p.currency || "SAR",
        paymentMethod: p.paymentMethod || "transfer",
        status: p.status || "pending",
        transferReference: p.transferReference || "",
        walletNumber: p.walletNumber || "",
        receiptUrl: p.receiptUrl || "",
        notes: p.notes || "",
        reviewedBy: p.reviewedBy || "",
        reviewedAt: p.reviewedAt || null,
        reviewerNotes: p.reviewerNotes || "",
      } as any).onConflictDoNothing();
      stats.paymentRequests++;
    } catch {}
  }

  // ---- Payment Settings ----
  const mongoPaySettings = await PaymentSettingsModel.find().lean();
  for (const s of mongoPaySettings) {
    try {
      await db.insert(paymentSettings).values({
        id: s.key || "default",
        bankName: s.bankName || (s as any).transfer?.bankName || null,
        accountName: s.accountName || (s as any).transfer?.accountName || null,
        accountNumber: s.accountNumber || (s as any).transfer?.accountNumber || null,
        iban: s.iban || (s as any).transfer?.iban || null,
        walletNumber: s.walletNumber || (s as any).wallet?.phoneNumber || null,
        enableCard: (s as any).card?.enabled || false,
        enableTransfer: (s as any).transfer?.enabled || false,
        enableWallet: (s as any).wallet?.enabled || false,
      } as any).onConflictDoNothing();
      stats.paymentSettings++;
    } catch {}
  }

  // ---- Study Plans ----
  const mongoPlans = await StudyPlanModel.find().lean();
  for (const p of mongoPlans) {
    try {
      await db.insert(studyPlans).values({
        id: String(p._id || p.id),
        userId: String(p.userId || ""),
        name: p.name || "",
        pathId: String(p.pathId || ""),
        subjectIds: p.subjectIds || [],
        courseIds: p.courseIds || [],
        startDate: p.startDate || "",
        endDate: p.endDate || "",
        skipCompletedQuizzes: p.skipCompletedQuizzes !== false,
        offDays: p.offDays || [],
        dailyMinutes: p.dailyMinutes || 90,
        preferredStartTime: p.preferredStartTime || "17:00",
        status: p.status || "active",
        createdAt: p.createdAt || 0,
        updatedAt: p.updatedAt || 0,
      } as any).onConflictDoNothing();
      stats.studyPlans++;
    } catch {}
  }

  // ---- Library Items ----
  const mongoLibrary = await LibraryItemModel.find().lean();
  for (const l of mongoLibrary) {
    try {
      await db.insert(libraryItems).values({
        id: String(l._id || l.id),
        title: l.title || "",
        size: l.size || "",
        downloads: l.downloads || 0,
        type: l.type || "pdf",
        pathId: l.pathId || null,
        subjectId: String(l.subjectId || ""),
        sectionId: l.sectionId || null,
        skillIds: l.skillIds || [],
        url: l.url || "",
        showOnPlatform: l.showOnPlatform !== false,
        isLocked: l.isLocked || false,
        ownerType: l.ownerType || "platform",
        ownerId: l.ownerId || null,
        createdBy: l.createdBy || null,
        assignedTeacherId: l.assignedTeacherId || null,
        approvalStatus: l.approvalStatus || "draft",
        approvedBy: l.approvedBy || null,
        approvedAt: l.approvedAt || null,
        reviewerNotes: l.reviewerNotes || null,
        revenueSharePercentage: l.revenueSharePercentage || null,
      } as any).onConflictDoNothing();
      stats.libraryItems++;
    } catch {}
  }

  // ---- Homepage Settings ----
  const mongoHomepage = await HomepageSettingsModel.find().lean();
  for (const h of mongoHomepage) {
    try {
      await db.insert(homepageSettings).values({
        id: h.key || "default",
        settings: (h as any).settings || h || {},
      } as any).onConflictDoNothing();
      stats.homepageSettings++;
    } catch {}
  }

  console.log("\n===========================================");
  console.log("Migration completed!");
  console.log("===========================================");
  for (const [key, count] of Object.entries(stats)) {
    console.log(`  ${key}: ${count}`);
  }
  console.log("===========================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
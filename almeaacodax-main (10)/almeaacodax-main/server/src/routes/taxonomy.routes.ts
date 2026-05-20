import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { PathModel } from "../models/Path.js";
import { LevelModel } from "../models/Level.js";
import { SubjectModel } from "../models/Subject.js";
import { SectionModel } from "../models/Section.js";
import { SkillModel } from "../models/Skill.js";
import { LessonModel } from "../models/Lesson.js";
import { QuestionModel } from "../models/Question.js";
import { LibraryItemModel } from "../models/LibraryItem.js";
import { QuizModel } from "../models/Quiz.js";
import { TopicModel } from "../models/Topic.js";
import { CourseModel } from "../models/Course.js";
import { ensureSkillTaxonomy } from "../services/ensureSkillTaxonomy.js";
import { clearActivePathIdsCache } from "../services/visibility.js";

const pathSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
  iconUrl: z.string().optional(),
  iconStyle: z.enum(["default", "modern", "minimal", "playful"]).optional(),
  showInNavbar: z.boolean().optional(),
  showInHome: z.boolean().optional(),
  isActive: z.boolean().optional(),
  parentPathId: z.string().nullable().optional(),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

const levelSchema = z.object({
  id: z.string().optional(),
  pathId: z.string().min(1),
  name: z.string().min(1),
});

const subjectSchema = z.object({
  id: z.string().optional(),
  pathId: z.string().min(1),
  levelId: z.string().nullable().optional(),
  name: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
  iconUrl: z.string().optional(),
  iconStyle: z.enum(["default", "modern", "minimal", "playful"]).optional(),
  settings: z.record(z.any()).optional(),
});

const sectionSchema = z.object({
  id: z.string().optional(),
  subjectId: z.string().min(1),
  name: z.string().min(1),
});

const skillSchema = z.object({
  id: z.string().optional(),
  pathId: z.string().min(1),
  subjectId: z.string().min(1),
  sectionId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  lessonIds: z.array(z.string()).default([]),
  questionIds: z.array(z.string()).default([]),
});

export const taxonomyRouter = Router();

const TAXONOMY_BOOTSTRAP_CACHE_TTL_MS = 3 * 60 * 1000;
const TAXONOMY_SEED_CHECK_TTL_MS = 5 * 60 * 1000;

let publicTaxonomyBootstrapCache:
  | {
      expiresAt: number;
      payload: {
        paths: unknown[];
        levels: unknown[];
        subjects: unknown[];
        sections: unknown[];
        skills: unknown[];
      };
    }
  | null = null;
let publicTaxonomyBootstrapPromise: Promise<{
  paths: unknown[];
  levels: unknown[];
  subjects: unknown[];
  sections: unknown[];
  skills: unknown[];
}> | null = null;
let skillTaxonomySeedCheckedAt = 0;
let skillTaxonomySeedPromise: Promise<unknown> | null = null;

const clearTaxonomyBootstrapCache = () => {
  publicTaxonomyBootstrapCache = null;
  publicTaxonomyBootstrapPromise = null;
  skillTaxonomySeedCheckedAt = 0;
  clearActivePathIdsCache();
};

const ensureSkillTaxonomyIfStale = async () => {
  const now = Date.now();
  if (skillTaxonomySeedPromise) {
    await skillTaxonomySeedPromise;
    return;
  }

  if (now - skillTaxonomySeedCheckedAt < TAXONOMY_SEED_CHECK_TTL_MS) {
    return;
  }

  skillTaxonomySeedPromise = ensureSkillTaxonomy()
    .finally(() => {
      skillTaxonomySeedCheckedAt = Date.now();
      skillTaxonomySeedPromise = null;
    });
  await skillTaxonomySeedPromise;
};

const buildPublicTaxonomyBootstrapPayload = async () => {
  const paths = await PathModel.find({ isActive: { $ne: false } }).sort({ createdAt: 1 }).lean();
  const visiblePathIds = paths.map((path) => String(path._id)).filter(Boolean);
  const [levels, subjects] =
    visiblePathIds.length > 0
      ? await Promise.all([
          LevelModel.find({ pathId: { $in: visiblePathIds } }).sort({ createdAt: 1 }).lean(),
          SubjectModel.find({ pathId: { $in: visiblePathIds } }).sort({ createdAt: 1 }).lean(),
        ])
      : [[], []];

  const visibleSubjectIds = subjects.map((subject) => String(subject._id)).filter(Boolean);
  const sections =
    visibleSubjectIds.length > 0
      ? await SectionModel.find({ subjectId: { $in: visibleSubjectIds } }).sort({ createdAt: 1 }).lean()
      : [];
  const visibleSectionIds = sections.map((section) => String(section._id)).filter(Boolean);
  const skills =
    visiblePathIds.length > 0 && visibleSubjectIds.length > 0 && visibleSectionIds.length > 0
      ? await SkillModel.find({
          pathId: { $in: visiblePathIds },
          subjectId: { $in: visibleSubjectIds },
          sectionId: { $in: visibleSectionIds },
        })
          .sort({ createdAt: 1 })
          .lean()
      : [];

  return {
    paths,
    levels,
    subjects,
    sections,
    skills,
  };
};

const getPublicTaxonomyBootstrapPayload = async () => {
  if (publicTaxonomyBootstrapCache && publicTaxonomyBootstrapCache.expiresAt > Date.now()) {
    return { payload: publicTaxonomyBootstrapCache.payload, cache: "hit" as const };
  }

  if (!publicTaxonomyBootstrapPromise) {
    publicTaxonomyBootstrapPromise = buildPublicTaxonomyBootstrapPayload()
      .then((payload) => {
        publicTaxonomyBootstrapCache = {
          expiresAt: Date.now() + TAXONOMY_BOOTSTRAP_CACHE_TTL_MS,
          payload,
        };
        return payload;
      })
      .finally(() => {
        publicTaxonomyBootstrapPromise = null;
      });
  }

  const payload = await publicTaxonomyBootstrapPromise;
  return { payload, cache: "miss" as const };
};

taxonomyRouter.use((req, _res, next) => {
  if (req.method !== "GET") {
    clearTaxonomyBootstrapCache();
  }
  next();
});

taxonomyRouter.get(
  "/bootstrap",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const canSeeInactiveTaxonomy = ["admin", "teacher", "supervisor"].includes(req.authUser?.role || "");
    if (canSeeInactiveTaxonomy) {
      await ensureSkillTaxonomyIfStale();
    } else {
      void ensureSkillTaxonomyIfStale().catch((error) => {
        console.warn("Deferred taxonomy seed check failed:", error);
      });
    }

    if (!canSeeInactiveTaxonomy && publicTaxonomyBootstrapCache && publicTaxonomyBootstrapCache.expiresAt > Date.now()) {
      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=180");
      res.setHeader("X-Taxonomy-Cache", "hit");
      return res.json(publicTaxonomyBootstrapCache.payload);
    }

    if (canSeeInactiveTaxonomy) {
      const [paths, levels, subjects, sections, skills] = await Promise.all([
        PathModel.find().sort({ createdAt: 1 }).lean(),
        LevelModel.find().sort({ createdAt: 1 }).lean(),
        SubjectModel.find().sort({ createdAt: 1 }).lean(),
        SectionModel.find().sort({ createdAt: 1 }).lean(),
        SkillModel.find().sort({ createdAt: 1 }).lean(),
      ]);
      return res.json({ paths, levels, subjects, sections, skills });
    }

    const { payload, cache } = await getPublicTaxonomyBootstrapPayload();
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=180");
    res.setHeader("X-Taxonomy-Cache", cache);
    return res.json(payload);
  }),
);

taxonomyRouter.post(
  "/paths",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = pathSchema.parse(req.body);
    const created = await PathModel.create({
      ...payload,
      ...(payload.id ? { _id: payload.id } : {}),
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

taxonomyRouter.patch(
  "/paths/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = pathSchema.partial().parse(req.body);
    const updated = await PathModel.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Path not found" });
    }
    return res.json(updated);
  }),
);

taxonomyRouter.delete(
  "/paths/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const deleted = await PathModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Path not found" });
    }

    const subjects = await SubjectModel.find({ pathId: req.params.id }).select("_id");
    const subjectIds = subjects.map((subject) => String(subject._id));
    const sections = subjectIds.length > 0 ? await SectionModel.find({ subjectId: { $in: subjectIds } }).select("_id") : [];
    const sectionIds = sections.map((section) => String(section._id));
    const skills = subjectIds.length > 0 ? await SkillModel.find({ subjectId: { $in: subjectIds } }).select("_id") : [];
    const skillIds = skills.map((skill) => String(skill._id));

    await Promise.all([
      LevelModel.deleteMany({ pathId: req.params.id }),
      SubjectModel.deleteMany({ pathId: req.params.id }),
      TopicModel.deleteMany({ pathId: req.params.id }),
      CourseModel.deleteMany({ pathId: req.params.id }),
      SectionModel.deleteMany({ subjectId: { $in: subjectIds } }),
      SkillModel.deleteMany({ subjectId: { $in: subjectIds } }),
      LessonModel.updateMany(
        { pathId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuestionModel.updateMany(
        { pathId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      LibraryItemModel.updateMany(
        { pathId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuizModel.updateMany(
        { pathId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
    ]);
    return res.json({ success: true, removedSections: sectionIds.length, removedSkills: skillIds.length });
  }),
);

taxonomyRouter.post(
  "/levels",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = levelSchema.parse(req.body);
    const created = await LevelModel.create({
      ...payload,
      ...(payload.id ? { _id: payload.id } : {}),
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

taxonomyRouter.patch(
  "/levels/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = levelSchema.partial().parse(req.body);
    const updated = await LevelModel.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Level not found" });
    }
    return res.json(updated);
  }),
);

taxonomyRouter.delete(
  "/levels/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const deleted = await LevelModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Level not found" });
    }
    const subjects = await SubjectModel.find({ levelId: req.params.id }).select("_id");
    const subjectIds = subjects.map((subject) => String(subject._id));
    const skills = subjectIds.length > 0 ? await SkillModel.find({ subjectId: { $in: subjectIds } }).select("_id") : [];
    const skillIds = skills.map((skill) => String(skill._id));

    await Promise.all([
      SubjectModel.deleteMany({ levelId: req.params.id }),
      SectionModel.deleteMany({ subjectId: { $in: subjectIds } }),
      SkillModel.deleteMany({ subjectId: { $in: subjectIds } }),
      TopicModel.deleteMany({ subjectId: { $in: subjectIds } }),
      LessonModel.updateMany(
        { subjectId: { $in: subjectIds } },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuestionModel.updateMany(
        { subject: { $in: subjectIds } },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      LibraryItemModel.updateMany(
        { subjectId: { $in: subjectIds } },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuizModel.updateMany(
        { subjectId: { $in: subjectIds } },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
    ]);
    return res.json({ success: true });
  }),
);

taxonomyRouter.post(
  "/subjects",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = subjectSchema.parse(req.body);
    const created = await SubjectModel.create({
      ...payload,
      ...(payload.id ? { _id: payload.id } : {}),
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

taxonomyRouter.patch(
  "/subjects/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = subjectSchema.partial().parse(req.body);
    const updated = await SubjectModel.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Subject not found" });
    }
    return res.json(updated);
  }),
);

taxonomyRouter.delete(
  "/subjects/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const deleted = await SubjectModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Subject not found" });
    }

    const sections = await SectionModel.find({ subjectId: req.params.id }).select("_id");
    const sectionIds = sections.map((section) => String(section._id));
    const skills = await SkillModel.find({ subjectId: req.params.id }).select("_id");
    const skillIds = skills.map((skill) => String(skill._id));

    await Promise.all([
      SectionModel.deleteMany({ subjectId: req.params.id }),
      SkillModel.deleteMany({ subjectId: req.params.id }),
      TopicModel.deleteMany({ subjectId: req.params.id }),
      LessonModel.updateMany(
        { subjectId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuestionModel.updateMany(
        { subject: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      LibraryItemModel.updateMany(
        { subjectId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuizModel.updateMany(
        { subjectId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      CourseModel.updateMany(
        { subjectId: req.params.id },
        {
          $set: { sectionId: null },
        },
      ),
    ]);

    return res.json({ success: true, removedSections: sectionIds.length, removedSkills: skillIds.length });
  }),
);

taxonomyRouter.post(
  "/sections",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = sectionSchema.parse(req.body);
    const created = await SectionModel.create({
      ...payload,
      ...(payload.id ? { _id: payload.id } : {}),
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

taxonomyRouter.patch(
  "/sections/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = sectionSchema.partial().parse(req.body);
    const updated = await SectionModel.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Section not found" });
    }
    return res.json(updated);
  }),
);

taxonomyRouter.delete(
  "/sections/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const deleted = await SectionModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Section not found" });
    }

    const skills = await SkillModel.find({ sectionId: req.params.id }).select("_id");
    const skillIds = skills.map((skill) => String(skill._id));

    await Promise.all([
      SkillModel.deleteMany({ sectionId: req.params.id }),
      LessonModel.updateMany(
        { sectionId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuestionModel.updateMany(
        { sectionId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      LibraryItemModel.updateMany(
        { sectionId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      QuizModel.updateMany(
        { sectionId: req.params.id },
        {
          $set: { sectionId: null },
          ...(skillIds.length > 0 ? { $pull: { skillIds: { $in: skillIds } } } : {}),
        },
      ),
      TopicModel.updateMany(
        { sectionId: req.params.id },
        {
          $set: { sectionId: null },
        },
      ),
      CourseModel.updateMany(
        { sectionId: req.params.id },
        {
          $set: { sectionId: null },
        },
      ),
    ]);

    return res.json({ success: true, removedSkills: skillIds.length });
  }),
);

taxonomyRouter.post(
  "/skills",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = skillSchema.parse(req.body);
    const created = await SkillModel.create({
      ...payload,
      ...(payload.id ? { _id: payload.id } : {}),
    });
    res.status(StatusCodes.CREATED).json(created);
  }),
);

taxonomyRouter.patch(
  "/skills/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const payload = skillSchema.partial().parse(req.body);
    const updated = await SkillModel.findByIdAndUpdate(req.params.id, payload, { new: true });
    if (!updated) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Skill not found" });
    }
    return res.json(updated);
  }),
);

taxonomyRouter.delete(
  "/skills/:id",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const deleted = await SkillModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(StatusCodes.NOT_FOUND).json({ message: "Skill not found" });
    }

    await Promise.all([
      LessonModel.updateMany({ skillIds: req.params.id }, { $pull: { skillIds: req.params.id } }),
      QuestionModel.updateMany({ skillIds: req.params.id }, { $pull: { skillIds: req.params.id } }),
      LibraryItemModel.updateMany({ skillIds: req.params.id }, { $pull: { skillIds: req.params.id } }),
      QuizModel.updateMany({ skillIds: req.params.id }, { $pull: { skillIds: req.params.id } }),
      CourseModel.updateMany({ skills: req.params.id }, { $pull: { skills: req.params.id } }),
    ]);

    return res.json({ success: true });
  }),
);

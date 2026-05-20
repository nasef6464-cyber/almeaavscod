import mongoose from "mongoose";
import { connectToDatabase } from "../config/db.js";
import { PathModel } from "../models/Path.js";
import { LevelModel } from "../models/Level.js";
import { SubjectModel } from "../models/Subject.js";
import { CourseModel } from "../models/Course.js";
import { ensureSkillTaxonomy } from "../services/ensureSkillTaxonomy.js";
import { courses as mockCourses } from "../../../services/mockData.js";

const seedPaths = [
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
  {
    _id: "p_nafes",
    name: "مسار نافس",
    color: "emerald",
    icon: "⭐",
    showInNavbar: true,
    showInHome: true,
    isActive: true,
    description: "مسار اختبارات وبرامج نافس.",
  },
];

const seedLevels = [
  { _id: "lvl_qudrat_general", pathId: "p_qudrat", name: "عام" },
  { _id: "lvl_tahsili_scientific", pathId: "p_tahsili", name: "علمي" },
  { _id: "lvl_nafes_general", pathId: "p_nafes", name: "عام" },
];

const seedSubjects = [
  { _id: "sub_quant", pathId: "p_qudrat", levelId: "lvl_qudrat_general", name: "الكمي", color: "purple", icon: "📘" },
  { _id: "sub_verbal", pathId: "p_qudrat", levelId: "lvl_qudrat_general", name: "اللفظي", color: "amber", icon: "📗" },
  { _id: "sub_math", pathId: "p_tahsili", levelId: "lvl_tahsili_scientific", name: "الرياضيات", color: "blue", icon: "📐" },
  { _id: "sub_physics", pathId: "p_tahsili", levelId: "lvl_tahsili_scientific", name: "الفيزياء", color: "indigo", icon: "🧲" },
  { _id: "sub_chemistry", pathId: "p_tahsili", levelId: "lvl_tahsili_scientific", name: "الكيمياء", color: "rose", icon: "🧪" },
  { _id: "sub_biology", pathId: "p_tahsili", levelId: "lvl_tahsili_scientific", name: "الأحياء", color: "emerald", icon: "🧬" },
  { _id: "sub_step_english", pathId: "p_nafes", levelId: "lvl_nafes_general", name: "STEP", color: "teal", icon: "🇬🇧" },
];

async function seedCollection() {
  await connectToDatabase();

  try {
    await Promise.all(
      seedPaths.map((path) =>
        PathModel.findByIdAndUpdate(path._id, path, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }),
      ),
    );

    await Promise.all(
      seedLevels.map((level) =>
        LevelModel.findByIdAndUpdate(level._id, level, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }),
      ),
    );

    await Promise.all(
      seedSubjects.map((subject) =>
        SubjectModel.findByIdAndUpdate(subject._id, subject, {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }),
      ),
    );

    await ensureSkillTaxonomy();

    await Promise.all(
      mockCourses.map((course: any) =>
        CourseModel.findByIdAndUpdate(
          course.id,
          { ...course, _id: course.id },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        ),
      ),
    );

    console.log("Seeded platform data:", {
      paths: seedPaths.length,
      levels: seedLevels.length,
      subjects: seedSubjects.length,
      courses: mockCourses.length,
    });
  } finally {
    await mongoose.disconnect();
  }
}

seedCollection().catch((error) => {
  console.error(error);
  process.exit(1);
});

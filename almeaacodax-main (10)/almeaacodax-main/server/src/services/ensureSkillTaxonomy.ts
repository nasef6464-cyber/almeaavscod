import { SectionModel } from "../models/Section.js";
import { SkillModel } from "../models/Skill.js";
import { SubjectModel } from "../models/Subject.js";

type SectionTemplate = {
  name: string;
  skills: string[];
};

const genericMathTemplate: SectionTemplate[] = [
  { name: "المفاهيم الأساسية", skills: ["فهم القواعد الأساسية", "تمييز أنواع الأسئلة", "قراءة المعطيات بدقة"] },
  { name: "التطبيق والحل", skills: ["حل المسائل المباشرة", "اختيار الإستراتيجية المناسبة", "تنفيذ الحل خطوة بخطوة"] },
  { name: "المراجعة والإتقان", skills: ["اكتشاف الأخطاء الشائعة", "تفسير الحلول", "السرعة والدقة"] },
];

const genericReadingTemplate: SectionTemplate[] = [
  { name: "الفهم والاستيعاب", skills: ["استخراج الفكرة الرئيسة", "تحديد التفاصيل المهمة", "فهم العلاقات داخل النص"] },
  { name: "التحليل اللغوي", skills: ["استنتاج المعنى", "تمييز الأسلوب", "فهم دلالات السياق"] },
  { name: "التطبيق والإتقان", skills: ["حل الأسئلة بسرعة", "تمييز المشتتات", "مراجعة الإجابة وتبريرها"] },
];

const subjectTemplates: Record<string, SectionTemplate[]> = {
  sub_quant: [
    { name: "الحساب", skills: ["العمليات الأساسية", "النسب والتناسب", "الكسور والنسب المئوية"] },
    { name: "الجبر", skills: ["المعادلات", "المقادير الجبرية", "المتتابعات والأنماط"] },
    { name: "الهندسة والقياس", skills: ["الزوايا والمثلثات", "المساحات والحجوم", "البيانات والإحصاء"] },
  ],
  sub_verbal: [
    { name: "استيعاب المقروء", skills: ["الفكرة الرئيسة", "التفاصيل والاستنتاج", "تحليل النص"] },
    { name: "التناظر اللفظي", skills: ["العلاقات اللفظية", "تمييز الصياغات", "الربط بين المعاني"] },
    { name: "إكمال الجمل", skills: ["فهم السياق", "اختيار الكلمة المناسبة", "تمييز المشتتات"] },
  ],
  sub_math: genericMathTemplate,
  sub_physics: [
    { name: "المفاهيم الأساسية", skills: ["القوانين الأساسية", "قراءة المعطيات", "تمييز الوحدات"] },
    { name: "التطبيق", skills: ["التعويض في القوانين", "حل المسائل", "تحليل الرسوم والبيانات"] },
    { name: "الإتقان", skills: ["ربط المفاهيم", "معالجة الأخطاء", "السرعة والدقة"] },
  ],
  sub_chemistry: [
    { name: "المفاهيم الأساسية", skills: ["فهم المفاهيم الكيميائية", "تمييز الرموز والمعادلات", "قراءة السؤال العلمي"] },
    { name: "التطبيق", skills: ["المعادلات الكيميائية", "الحسابات الكيميائية", "تحليل التجارب"] },
    { name: "الإتقان", skills: ["الربط بين المفاهيم", "اكتشاف الأخطاء", "حل الأسئلة المركبة"] },
  ],
  sub_biology: [
    { name: "المفاهيم الأساسية", skills: ["فهم المصطلحات", "تمييز التراكيب الحيوية", "قراءة الرسوم"] },
    { name: "التطبيق", skills: ["تفسير العمليات الحيوية", "حل الأسئلة المباشرة", "الربط بين الأجزاء"] },
    { name: "الإتقان", skills: ["التحليل والاستنتاج", "معالجة الأخطاء الشائعة", "اختيار الإجابة الأدق"] },
  ],
  sub_step_english: [
    { name: "القراءة", skills: ["فهم الفكرة العامة", "استنتاج المعنى", "تمييز التفاصيل"] },
    { name: "اللغة", skills: ["القواعد", "المفردات", "استخدام السياق"] },
    { name: "التطبيق", skills: ["حل الأسئلة بسرعة", "تمييز المشتتات", "المراجعة النهائية"] },
  ],
};

const slugId = (prefix: string, subjectId: string, index: number, childIndex?: number) =>
  childIndex === undefined ? `${prefix}_${subjectId}_${index + 1}` : `${prefix}_${subjectId}_${index + 1}_${childIndex + 1}`;

const getTemplateForSubject = (subjectId: string, subjectName: string) => {
  if (subjectTemplates[subjectId]) {
    return subjectTemplates[subjectId];
  }

  const normalized = subjectName.trim();
  if (normalized.includes("رياضيات")) return genericMathTemplate;
  if (normalized.includes("قراءة") || normalized.includes("لفظي") || normalized.includes("لغة")) return genericReadingTemplate;

  return [
    { name: "المفاهيم الأساسية", skills: ["فهم المفاهيم", "قراءة المعطيات", "تمييز العناصر الأساسية"] },
    { name: "التطبيق", skills: ["حل التدريبات", "اختيار الإستراتيجية", "تنفيذ الحل بشكل صحيح"] },
    { name: "الإتقان", skills: ["المراجعة والتحليل", "اكتشاف الأخطاء", "رفع السرعة والدقة"] },
  ];
};

export async function ensureSkillTaxonomy() {
  const [subjects, existingSections, existingSkills] = await Promise.all([
    SubjectModel.find().sort({ createdAt: 1 }),
    SectionModel.find().sort({ createdAt: 1 }),
    SkillModel.find().sort({ createdAt: 1 }),
  ]);

  const sectionsToCreate: Array<{ _id: string; subjectId: string; name: string }> = [];
  const skillsToCreate: Array<{
    _id: string;
    pathId: string;
    subjectId: string;
    sectionId: string;
    name: string;
    description: string;
    lessonIds: string[];
    questionIds: string[];
  }> = [];

  subjects.forEach((subject) => {
    const subjectId = String(subject.id || subject._id);
    const subjectSections = existingSections.filter((section) => String(section.subjectId) === subjectId);
    const subjectSkills = existingSkills.filter((skill) => String(skill.subjectId) === subjectId);

    if (subjectSections.length > 0 || subjectSkills.length > 0) {
      return;
    }

    const template = getTemplateForSubject(subjectId, subject.name);
    template.forEach((sectionTemplate, sectionIndex) => {
      const sectionId = slugId("sec", subjectId, sectionIndex);
      sectionsToCreate.push({
        _id: sectionId,
        subjectId,
        name: sectionTemplate.name,
      });

      sectionTemplate.skills.forEach((skillName, skillIndex) => {
        skillsToCreate.push({
          _id: slugId("sk", subjectId, sectionIndex, skillIndex),
          pathId: subject.pathId,
          subjectId,
          sectionId,
          name: skillName,
          description: `مهارة افتراضية مبدئية لمادة ${subject.name} قابلة للتعديل من مركز المهارات.`,
          lessonIds: [],
          questionIds: [],
        });
      });
    });
  });

  if (sectionsToCreate.length > 0) {
    await SectionModel.bulkWrite(
      sectionsToCreate.map((section) => ({
        updateOne: {
          filter: { _id: section._id },
          update: { $setOnInsert: section },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  if (skillsToCreate.length > 0) {
    await SkillModel.bulkWrite(
      skillsToCreate.map((skill) => ({
        updateOne: {
          filter: { _id: skill._id },
          update: { $setOnInsert: skill },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  return {
    createdSections: sectionsToCreate.length,
    createdSkills: skillsToCreate.length,
  };
}

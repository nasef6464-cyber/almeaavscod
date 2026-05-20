import { LearningRecommendation, SkillGap } from "../types";
import { api } from "./api";
import { sanitizeArabicText } from "../utils/sanitizeMojibakeArabic";

const displayText = (value?: string | null) => sanitizeArabicText(value) || "";

const buildLocalStudentReply = (message: string): string => {
  const normalized = message.trim().toLowerCase();
  const isQuant = /كمي|رياض|معادل|كسور|نسبة|نسب|مسائل|حساب|جبر/.test(normalized);
  const isVerbal = /لفظ|قراءة|نص|معنى|مرادف|استيعاب|سياق/.test(normalized);
  const isStudy = /أذاكر|اذاكر|مذاكر|خطة|جدول|اليوم|ابدأ|ابدا/.test(normalized);

  if (isStudy) {
    return [
      "خطة قصيرة لليوم:",
      "1. راجع فكرة واحدة فقط لمدة 10 دقائق.",
      "2. حل 5 أسئلة سهلة لتثبيت الفكرة.",
      "3. حل 5 أسئلة متوسطة وسجل الأخطاء.",
      "4. أعد سؤالين أخطأت فيهما بدون النظر للحل.",
      isQuant ? "ابدأ في الكمي بالكسور والنسب أو المعادلات لأنها أكثر تكرارا." : "",
      isVerbal ? "ابدأ في اللفظي بفهم الفكرة الرئيسة ومعاني الكلمات من السياق." : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (isQuant) {
    return [
      "خلينا نمسكها كمي خطوة بخطوة:",
      "1. حدد المطلوب في السؤال قبل الحساب.",
      "2. اكتب المعطيات كأرقام أو علاقة بسيطة.",
      "3. جرّب طريقة مباشرة: تعويض، تبسيط كسر، أو تكوين معادلة.",
      "4. بعد الحل راجع هل الإجابة منطقية مقارنة بالاختيارات.",
      "اكتب لي نص السؤال أو فكرته، وسأرتبه لك كخطوات حل.",
    ].join("\n");
  }

  if (isVerbal) {
    return [
      "في اللفظي ركز على الفكرة قبل الاختيارات:",
      "1. اقرأ الجملة أو الفقرة مرة للفهم العام.",
      "2. حدد الكلمة المفتاحية أو علاقة السبب والنتيجة.",
      "3. احذف الاختيارات البعيدة عن السياق.",
      "4. اختر الإجابة التي تخدم معنى الجملة بالكامل.",
      "اكتب لي النص أو السؤال، وسأساعدك في تفكيكه.",
    ].join("\n");
  }

  return [
    "أنا معك. اكتب السؤال أو المهارة التي تريد فهمها، وسأقسمها لك إلى:",
    "1. الفكرة الأساسية.",
    "2. مثال سريع.",
    "3. تدريب قصير.",
    "4. طريقة تتأكد بها أنك أتقنتها.",
  ].join("\n");
};

const sanitizeRecommendation = (item: LearningRecommendation): LearningRecommendation => ({
  ...item,
  title: displayText(item.title),
  duration: displayText(item.duration),
  reason: displayText(item.reason),
  skillTargeted: displayText(item.skillTargeted),
  actionLabel: displayText(item.actionLabel),
});

export type StudentChatResponse = {
  text: string;
  personalized: boolean;
  weaknessesCount: number;
  provider?: "gemini" | "openrouter" | "deepseek" | "qwen" | "openai" | "ollama" | "lmstudio" | "none";
  model?: string;
  usedFallback?: boolean;
};

export const getChatResponse = async (message: string): Promise<StudentChatResponse> => {
  try {
    const response = await api.aiChat({ message });
    const text = displayText(response.text);
    return {
      text: text || buildLocalStudentReply(message),
      personalized: Boolean(response.personalized),
      weaknessesCount: Number(response.weaknessesCount || 0),
      provider: response.provider || "none",
      model: response.model || "local-fallback",
      usedFallback: Boolean(response.usedFallback),
    };
  } catch {
    return {
      text: buildLocalStudentReply(message),
      personalized: false,
      weaknessesCount: 0,
      provider: "none",
      model: "local-fallback",
      usedFallback: true,
    };
  }
};

export const generateStudyPlan = async (weaknesses: string[]): Promise<string> => {
  try {
    const response = await api.aiStudyPlan({ weaknesses });
    return JSON.stringify({ steps: (response.steps || []).map(displayText) });
  } catch {
    return JSON.stringify({
      steps: ["راجع الفكرة الأساسية", "حل تدريبًا قصيرًا", "أعد اختبارًا مصغرًا"],
    });
  }
};

export const explainQuestion = async (
  questionText: string,
  studentAnswer: string,
  correctAnswer: string,
): Promise<string> => {
  const message = `اشرح لي ببساطة لماذا إجابتي "${studentAnswer}" ليست الأنسب في السؤال "${questionText}"، ولماذا الإجابة الصحيحة هي "${correctAnswer}".`;
  const response = await getChatResponse(message);
  return response.text;
};

export const generateLearningPath = async (skills: SkillGap[]): Promise<LearningRecommendation[]> => {
  const targetSkills = skills.filter((skill) => skill.status === "weak" || skill.status === "average");
  if (targetSkills.length === 0) return [];

  try {
    const response = await api.aiLearningPath({ skills: targetSkills });
    return Array.isArray(response)
      ? (response as LearningRecommendation[]).map(sanitizeRecommendation)
      : buildLearningFallback(targetSkills);
  } catch {
    return buildLearningFallback(targetSkills);
  }
};

export const generateQuizQuestion = async (topic: string): Promise<any> => {
  try {
    const response = await api.aiQuestion({ topic });
    if (response && typeof response === "object") {
      return response;
    }
  } catch {
    // Fall through to the safe local fallback below.
  }

  return {
    question: `سؤال تدريبي في ${topic}: ما الاختيار الصحيح؟`,
    options: ["الاختيار الأول", "الاختيار الثاني", "الاختيار الثالث", "الاختيار الرابع"],
    correctIndex: 0,
    explanation: "هذا سؤال مبدئي آمن. راجع السؤال قبل نشره للطلاب.",
  };
};

export const generateCourseSummary = async (courseTitle: string): Promise<string> => {
  try {
    const response = await api.aiCourseSummary({ courseTitle });
    return displayText(response.text) || "شرح الدورة غير متوفر حاليًا.";
  } catch {
    return "شرح الدورة غير متوفر حاليًا.";
  }
};

const buildLearningFallback = (skills: SkillGap[]): LearningRecommendation[] =>
  skills.slice(0, 3).map((skill, index) => ({
    id: `rec_${index + 1}`,
    type: index === 1 ? "quiz" : "lesson",
    title: `مراجعة ${displayText(skill.skill)}`,
    duration: index === 1 ? "10 دقائق" : "15 دقيقة",
    reason: `لأن مستوى الإتقان يحتاج دعمًا في ${displayText(skill.skill)}.`,
    skillTargeted: displayText(skill.skill),
    priority: skill.status === "weak" ? "high" : "medium",
    actionLabel: index === 1 ? "ابدأ التدريب" : "ابدأ الدرس",
    link: "/dashboard",
  }));

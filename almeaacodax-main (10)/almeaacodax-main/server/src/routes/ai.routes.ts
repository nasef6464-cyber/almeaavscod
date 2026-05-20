import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { AiInteractionModel } from "../models/AiInteraction.js";
import { QuizResultModel } from "../models/QuizResult.js";
import { SkillProgressModel } from "../models/SkillProgress.js";
import { UserModel } from "../models/User.js";
import { createOperationsAudit } from "../services/operationsAudit.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
});

const adminAssistantSchema = z.object({
  message: z.string().min(1).max(2000),
});

const providerTestSchema = z.object({
  provider: z.enum(["gemini", "openrouter", "deepseek", "qwen", "openai", "ollama", "lmstudio"]),
});

const studyPlanSchema = z.object({
  weaknesses: z.array(z.string()).default([]),
});

const learningPathSchema = z.object({
  skills: z.array(z.record(z.any())).default([]),
});

const remediationPlanSchema = z.object({
  skills: z.array(z.record(z.any())).default([]),
  ageBand: z.enum(["primary", "middle", "secondary", "general"]).default("general"),
});

const questionSchema = z.object({
  topic: z.string().min(1).max(500),
});

const courseSummarySchema = z.object({
  courseTitle: z.string().min(1).max(500),
});

type AiResponseMimeType = "application/json";
type AiProvider = "gemini" | "openrouter" | "deepseek" | "qwen" | "openai" | "ollama" | "lmstudio" | "none";

type StudentAiContext = {
  summary: string;
  weaknesses: Array<{ skill: string; mastery: number; status: string; action: string }>;
  recentResults: Array<{ title: string; score: number; totalQuestions: number; wrongAnswers: number }>;
};

type ProviderDescriptor = {
  id: AiProvider;
  label: string;
  model: string;
  configured: boolean;
  category: "free-friendly" | "paid" | "local" | "fallback";
  envKeys: string[];
  note: string;
};

type AiCallResult = {
  text: string;
  provider: AiProvider;
  model: string;
  usedFallback: boolean;
  errors: string[];
};

const isOllamaExplicitlyConfigured = () =>
  Boolean(process.env.AI_PROVIDER === "ollama" || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL);
const isLmStudioExplicitlyConfigured = () =>
  Boolean(process.env.AI_PROVIDER === "lmstudio" || process.env.LM_STUDIO_BASE_URL || process.env.LM_STUDIO_MODEL);

const configuredProviders = (): ProviderDescriptor[] => [
  {
    id: "gemini",
    label: "Google Gemini",
    model: env.GEMINI_MODEL,
    configured: Boolean(env.GEMINI_API_KEY),
    category: "free-friendly",
    envKeys: ["AI_PROVIDER_ORDER", "GEMINI_API_KEY", "GEMINI_MODEL"],
    note: "مناسب كبداية مجانية أو منخفضة التكلفة حسب حدود حساب Google AI Studio.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    model: env.OPENROUTER_MODEL,
    configured: Boolean(env.OPENROUTER_API_KEY),
    category: "free-friendly",
    envKeys: ["AI_PROVIDER_ORDER", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
    note: "يدعم موديلات كثيرة ومنها Qwen وDeepSeek وبعض النماذج المجانية عند توفرها.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    model: env.DEEPSEEK_MODEL,
    configured: Boolean(env.DEEPSEEK_API_KEY),
    category: "paid",
    envKeys: ["AI_PROVIDER_ORDER", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL"],
    note: "قوي ورخيص عادة، مناسب لمساعد المدير والتحليلات الطويلة.",
  },
  {
    id: "qwen",
    label: "Qwen / Alibaba Model Studio",
    model: env.QWEN_MODEL,
    configured: Boolean(env.QWEN_API_KEY),
    category: "free-friendly",
    envKeys: ["AI_PROVIDER_ORDER", "QWEN_API_KEY", "QWEN_MODEL", "QWEN_BASE_URL"],
    note: "خيار صيني ممتاز، وغالبا مناسب للتجارب والحصص المجانية حسب الحساب.",
  },
  {
    id: "openai",
    label: "OpenAI",
    model: env.OPENAI_MODEL,
    configured: Boolean(env.OPENAI_API_KEY),
    category: "paid",
    envKeys: ["AI_PROVIDER_ORDER", "OPENAI_API_KEY", "OPENAI_MODEL"],
    note: "مناسب عند الحاجة لجودة واستقرار أعلى، وغالبا يكون مدفوعا حسب الاستهلاك.",
  },
  {
    id: "ollama",
    label: "Ollama محلي",
    model: env.OLLAMA_MODEL,
    configured: isOllamaExplicitlyConfigured() && Boolean(env.OLLAMA_BASE_URL && env.OLLAMA_MODEL),
    category: "local",
    envKeys: ["AI_PROVIDER_ORDER", "OLLAMA_BASE_URL", "OLLAMA_MODEL"],
    note: "مجاني محليا، لكنه يحتاج جهاز أو خادم دائم متاح للسيرفر.",
  },
  {
    id: "lmstudio",
    label: "LM Studio محلي",
    model: env.LM_STUDIO_MODEL,
    configured: isLmStudioExplicitlyConfigured() && Boolean(env.LM_STUDIO_BASE_URL && env.LM_STUDIO_MODEL),
    category: "local",
    envKeys: ["AI_PROVIDER_ORDER", "LM_STUDIO_BASE_URL", "LM_STUDIO_MODEL"],
    note: "مجاني محليا للتجارب، وليس مثاليا لإنتاج Render المجاني.",
  },
  {
    id: "none",
    label: "ردود احتياطية داخلية",
    model: "local-fallback",
    configured: true,
    category: "fallback",
    envKeys: [],
    note: "يضمن أن المساعد لا يتوقف حتى لو تعطلت كل المفاتيح.",
  },
];

const providerPriority = () => {
  const fromEnv = env.AI_PROVIDER_ORDER.split(",")
    .map((value) => value.trim().toLowerCase() as AiProvider)
    .filter(Boolean);
  const preferred = env.AI_PROVIDER ? [env.AI_PROVIDER] : [];
  const defaults: AiProvider[] = ["gemini", "openrouter", "qwen", "deepseek", "openai", "ollama", "lmstudio", "none"];
  return [...new Set([...preferred, ...fromEnv, ...defaults])].filter((provider) =>
    configuredProviders().some((candidate) => candidate.id === provider),
  );
};

const ARABIC_TUTOR_RULES = `
أنت مساعد تعليمي عربي داخل منصة تعليمية للقدرات والتحصيلي.
اكتب بلغة عربية بسيطة ومشجعة ومناسبة للطلاب من المرحلة الابتدائية حتى الثانوية.
اجعل كل إجابة عملية ومختصرة، وركز دائمًا على: التشخيص، خطوة علاجية، تدريب قصير، ثم تحقق من الإتقان.
لا تذكر أنك نموذج ذكاء اصطناعي، ولا تقدم وعودًا طبية أو قانونية، ولا تطلب بيانات حساسة من الطالب.
عند الحديث عن المهارات استخدم الصيغة: المادة - المهارة الرئيسية - المهارة الفرعية متى توفرت البيانات.
`;

const safeJsonParse = <T>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;
  const trimmed = value.trim();
  const starts = [trimmed.indexOf("["), trimmed.indexOf("{")].filter((index) => index >= 0);
  const jsonStart = starts.length ? Math.min(...starts) : -1;
  const jsonEnd = Math.max(trimmed.lastIndexOf("]"), trimmed.lastIndexOf("}"));
  const jsonCandidate = jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;

  try {
    return JSON.parse(jsonCandidate) as T;
  } catch {
    return fallback;
  }
};

const formatSkillContext = (skill: Record<string, unknown>) =>
  [skill.subjectName, skill.sectionName || skill.section, skill.skill || skill.name]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ") || "مهارة تحتاج متابعة";

const buildTutorFallback = (message: string) => {
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

const buildStudentAiContext = async (userId?: string | null): Promise<StudentAiContext | null> => {
  if (!userId) return null;

  const [user, weaknesses, recentResults] = await Promise.all([
    UserModel.findById(userId).select("name role subscription completedLessons enrolledPaths").lean(),
    SkillProgressModel.find({ userId, status: { $in: ["weak", "average"] } })
      .sort({ mastery: 1, lastAttemptAt: -1 })
      .limit(6)
      .lean(),
    QuizResultModel.find({ userId }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  if (!user || user.role !== "student") return null;

  const progressWeakSkillRows = weaknesses.map((item) => ({
    skill: String(item.skill || "مهارة تحتاج مراجعة"),
    mastery: Number(item.mastery || 0),
    status: String(item.status || "weak"),
    action: String(item.recommendedAction || "راجع شرحا قصيرا ثم حل تدريبا متدرجا."),
  }));
  const resultRows = recentResults.map((item) => ({
    title: String(item.quizTitle || "اختبار سابق"),
    score: Number(item.score || 0),
    totalQuestions: Number(item.totalQuestions || 0),
    wrongAnswers: Number(item.wrongAnswers || 0),
  }));
  const resultWeakSkillRows = recentResults
    .flatMap((item) => (Array.isArray(item.skillsAnalysis) ? item.skillsAnalysis : []))
    .filter((item) => String(item?.status || "") === "weak" || String(item?.status || "") === "average" || Number(item?.mastery || 0) < 75)
    .map((item) => ({
      skill: String(item.skill || item.name || "مهارة تحتاج مراجعة"),
      mastery: Number(item.mastery || 0),
      status: String(item.status || "weak"),
      action: String(item.recommendation || "راجع شرحا قصيرا ثم حل تدريبا متدرجا."),
    }));
  const weakSkillRows = progressWeakSkillRows.length ? progressWeakSkillRows : resultWeakSkillRows;

  const summaryLines = [
    `اسم الطالب: ${String(user.name || "طالب")}`,
    weakSkillRows.length
      ? `أضعف المهارات الحالية: ${weakSkillRows
          .map((item) => `${item.skill} (${item.mastery}%)`)
          .join("، ")}`
      : "لا توجد مهارات ضعيفة مسجلة حتى الآن.",
    resultRows.length
      ? `آخر النتائج: ${resultRows.map((item) => `${item.title}: ${item.score}%`).join("، ")}`
      : "لا توجد نتائج اختبارات حديثة.",
    `الدروس المكتملة: ${Array.isArray(user.completedLessons) ? user.completedLessons.length : 0}`,
  ];

  return {
    summary: summaryLines.join("\n"),
    weaknesses: weakSkillRows,
    recentResults: resultRows,
  };
};

const buildPersonalizedTutorFallback = (message: string, context: StudentAiContext | null) => {
  const base = buildTutorFallback(message);
  if (!context) return base;

  const asksAboutWeakness =
    /ضعيف|ضعفي|مستواي|ابدأ|ابدا|خطة|أذاكر|اذاكر|ماذا أراجع|ايه اراجع|إيه أراجع/.test(message.trim().toLowerCase());
  if (context.weaknesses.length === 0) return base;

  const topWeakness = context.weaknesses[0];
  const nextWeakness = context.weaknesses[1];
  const advisorIntro = [
    `حسب أدائك الحالي، ابدأ بمهارة: ${topWeakness.skill} لأنها عند ${topWeakness.mastery}%.`,
    nextWeakness ? `بعدها راجع: ${nextWeakness.skill} (${nextWeakness.mastery}%).` : "",
    asksAboutWeakness ? "خطة عملية:" : "ملاحظة سريعة قبل الإجابة:",
    "1. شاهد شرحا قصيرا للمهارة الأولى.",
    "2. حل 5 أسئلة سهلة ثم 5 أسئلة متوسطة.",
    "3. سجل سبب كل خطأ: فهم قانون، استعجال، أو اختيار طريقة غير مناسبة.",
    "4. أعد اختبارا قصيرا، ولو وصلت 75% انتقل للمهارة التالية.",
    topWeakness.action ? `توجيه المنصة لك: ${topWeakness.action}` : "",
  ].filter(Boolean);

  return [
    ...advisorIntro,
    "",
    base,
  ]
    .filter(Boolean)
    .join("\n");
};

const preview = (value: unknown, maxLength = 260) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const modelForProvider = (provider: AiProvider) =>
  configuredProviders().find((candidate) => candidate.id === provider)?.model || "local-fallback";

const recordAiInteraction = async (payload: {
  req: any;
  endpoint: string;
  audience?: string;
  message: string;
  responseText: string;
  provider: AiProvider;
  model?: string;
  usedFallback: boolean;
  personalized?: boolean;
  latencyMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    const role = String(payload.req.authUser?.role || payload.audience || "guest");
    await AiInteractionModel.create({
      audience: payload.audience || role || "guest",
      endpoint: payload.endpoint,
      provider: payload.provider,
      model: payload.model || modelForProvider(payload.provider),
      status: payload.error ? "error" : payload.usedFallback ? "fallback" : "success",
      usedFallback: payload.usedFallback,
      personalized: Boolean(payload.personalized),
      latencyMs: payload.latencyMs,
      messagePreview: preview(payload.message),
      responsePreview: preview(payload.responseText),
      responseLength: String(payload.responseText || "").length,
      error: preview(payload.error, 500),
      userId: payload.req.authUser?.id || "",
      userEmail: payload.req.authUser?.email || "",
      role,
      metadata: payload.metadata || {},
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("Failed to record AI interaction", error);
    }
  }
};

const resolveProvider = (): AiProvider =>
  providerPriority().find((provider) => provider !== "none" && configuredProviders().find((candidate) => candidate.id === provider)?.configured) ||
  "none";

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const callGemini = async (prompt: string, responseMimeType?: AiResponseMimeType) => {
  if (!env.GEMINI_API_KEY) return "";

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: responseMimeType ? { responseMimeType } : undefined,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
};

const callOllama = async (prompt: string, responseMimeType?: AiResponseMimeType) => {
  const response = await fetchWithTimeout(`${env.OLLAMA_BASE_URL.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      prompt,
      stream: false,
      format: responseMimeType === "application/json" ? "json" : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { response?: string };
  return payload.response?.trim() || "";
};

const callLmStudio = async (prompt: string, responseMimeType?: AiResponseMimeType) => {
  const response = await fetchWithTimeout(`${env.LM_STUDIO_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.LM_STUDIO_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: responseMimeType === "application/json" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || "";
};

const callOpenAiCompatible = async (
  provider: Exclude<AiProvider, "gemini" | "ollama" | "lmstudio" | "none">,
  prompt: string,
  responseMimeType?: AiResponseMimeType,
) => {
  const settings: Record<typeof provider, { baseUrl: string; apiKey?: string; model: string; headers?: Record<string, string> }> = {
    openrouter: {
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      headers: {
        "HTTP-Referer": env.CLIENT_URL,
        "X-Title": "Almeaa Educational Platform",
      },
    },
    deepseek: {
      baseUrl: "https://api.deepseek.com",
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.DEEPSEEK_MODEL,
    },
    qwen: {
      baseUrl: env.QWEN_BASE_URL,
      apiKey: env.QWEN_API_KEY,
      model: env.QWEN_MODEL,
    },
    openai: {
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    },
  };
  const selected = settings[provider];
  if (!selected.apiKey) return "";

  const response = await fetchWithTimeout(`${selected.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${selected.apiKey}`,
      ...(selected.headers || {}),
    },
    body: JSON.stringify({
      model: selected.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.25,
      response_format: responseMimeType === "application/json" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`${provider} request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || "";
};

const callAiWithMeta = async (prompt: string, responseMimeType?: AiResponseMimeType): Promise<AiCallResult> => {
  const errors: string[] = [];

  for (const provider of providerPriority()) {
    const descriptor = configuredProviders().find((candidate) => candidate.id === provider);
    if (!descriptor?.configured || provider === "none") {
      continue;
    }

    try {
      let text = "";
      if (provider === "gemini") {
        text = await callGemini(prompt, responseMimeType);
      }
      if (provider === "ollama") {
        text = await callOllama(prompt, responseMimeType);
      }
      if (provider === "lmstudio") {
        text = await callLmStudio(prompt, responseMimeType);
      }
      if (provider === "openrouter" || provider === "deepseek" || provider === "qwen" || provider === "openai") {
        text = await callOpenAiCompatible(provider, prompt, responseMimeType);
      }
      if (text) {
        return {
          text,
          provider,
          model: descriptor.model,
          usedFallback: false,
          errors,
        };
      }
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (errors.length && process.env.NODE_ENV !== "test") {
    console.warn("AI providers failed, using fallback:", errors.join(" | "));
  }

  return {
    text: "",
    provider: "none",
    model: "local-fallback",
    usedFallback: true,
    errors,
  };
};

const callAi = async (prompt: string, responseMimeType?: AiResponseMimeType) => (await callAiWithMeta(prompt, responseMimeType)).text;

const callSingleProvider = async (provider: Exclude<AiProvider, "none">, prompt: string) => {
  if (provider === "gemini") return callGemini(prompt);
  if (provider === "ollama") return callOllama(prompt);
  if (provider === "lmstudio") return callLmStudio(prompt);
  return callOpenAiCompatible(provider, prompt);
};

export const aiRouter = Router();

aiRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const providers = configuredProviders();
    const activeProvider = resolveProvider();
    res.json({
      provider: activeProvider,
      ollamaConfigured: isOllamaExplicitlyConfigured() && Boolean(env.OLLAMA_BASE_URL && env.OLLAMA_MODEL),
      lmStudioConfigured: isLmStudioExplicitlyConfigured() && Boolean(env.LM_STUDIO_BASE_URL && env.LM_STUDIO_MODEL),
      geminiConfigured: Boolean(env.GEMINI_API_KEY),
      providers,
      providerOrder: providerPriority(),
      model: providers.find((provider) => provider.id === activeProvider)?.model || "local-fallback",
      timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    });
  }),
);

aiRouter.get(
  "/readiness",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (_req, res) => {
    const providers = configuredProviders();
    const activeProvider = resolveProvider();
    const configuredRealProviders = providers.filter((provider) => provider.id !== "none" && provider.configured);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      studentCount,
      studentsWithResults,
      weakSkillSignals,
      studentChats24h,
      personalizedStudentChats7d,
      fallbackStudentChats24h,
      adminChats24h,
      aiErrors24h,
    ] = await Promise.all([
      UserModel.countDocuments({ role: "student" }),
      QuizResultModel.distinct("userId").then((ids) => ids.length),
      SkillProgressModel.countDocuments({ status: { $in: ["weak", "average"] } }),
      AiInteractionModel.countDocuments({ endpoint: "/ai/chat", audience: "student", createdAt: { $gte: since24h } }),
      AiInteractionModel.countDocuments({
        endpoint: "/ai/chat",
        audience: "student",
        personalized: true,
        createdAt: { $gte: since7d },
      }),
      AiInteractionModel.countDocuments({
        endpoint: "/ai/chat",
        audience: "student",
        usedFallback: true,
        createdAt: { $gte: since24h },
      }),
      AiInteractionModel.countDocuments({ endpoint: "/ai/admin-assistant", audience: "admin", createdAt: { $gte: since24h } }),
      AiInteractionModel.countDocuments({ status: "error", createdAt: { $gte: since24h } }),
    ]);

    const providerScore = configuredRealProviders.length > 0 ? 30 : 12;
    const dataScore = studentCount > 0 && studentsWithResults > 0 ? 25 : studentCount > 0 ? 12 : 0;
    const guidanceScore = weakSkillSignals > 0 ? 25 : 8;
    const monitoringScore = aiErrors24h === 0 ? 20 : Math.max(0, 20 - Math.min(aiErrors24h * 5, 20));
    const score = Math.max(0, Math.min(100, providerScore + dataScore + guidanceScore + monitoringScore));

    const nextActions = [
      configuredRealProviders.length === 0
        ? "أضف مفتاح مزود ذكاء واحد على الأقل في Render حتى ينتقل المساعد من الرد الاحتياطي إلى ذكاء توليدي حقيقي."
        : "",
      studentsWithResults === 0
        ? "اجعل طالبا يجري اختبارا قصيرا حتى يمتلك المساعد بيانات أداء يبني عليها خطة شخصية."
        : "",
      weakSkillSignals === 0
        ? "اربط الأسئلة والنتائج بالمهارات حتى يعرف المساعد نقاط الضعف بدقة."
        : "",
      fallbackStudentChats24h > 0 && configuredRealProviders.length > 0
        ? "راجع ترتيب AI_PROVIDER_ORDER أو اختبر المزودين لأن بعض محادثات الطالب استخدمت الرد الاحتياطي."
        : "",
      aiErrors24h > 0
        ? "راجع سجل استخدام المساعد لأن هناك أخطاء في آخر 24 ساعة."
        : "",
    ].filter(Boolean);

    res.json({
      checkedAt: new Date().toISOString(),
      score,
      activeProvider,
      configuredProviders: configuredRealProviders.map((provider) => ({
        id: provider.id,
        label: provider.label,
        model: provider.model,
      })),
      recommendedProviderOrder: providerPriority().join(","),
      studentAdvisor: {
        ready: studentCount > 0 && (studentsWithResults > 0 || weakSkillSignals > 0),
        studentCount,
        studentsWithResults,
        weakSkillSignals,
        studentChats24h,
        personalizedStudentChats7d,
        fallbackStudentChats24h,
      },
      adminAssistant: {
        ready: true,
        chats24h: adminChats24h,
      },
      monitoring: {
        aiErrors24h,
        fallbackStudentChats24h,
      },
      nextActions,
    });
  }),
);

aiRouter.get(
  "/interactions",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [items, total, last24h, fallbackCount, errorCount, byAudience, byProvider] = await Promise.all([
      AiInteractionModel.find().sort({ createdAt: -1 }).limit(limit).lean(),
      AiInteractionModel.countDocuments(),
      AiInteractionModel.countDocuments({ createdAt: { $gte: since } }),
      AiInteractionModel.countDocuments({ usedFallback: true }),
      AiInteractionModel.countDocuments({ status: "error" }),
      AiInteractionModel.aggregate([
        { $group: { _id: "$audience", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AiInteractionModel.aggregate([
        { $group: { _id: "$provider", count: { $sum: 1 }, avgLatencyMs: { $avg: "$latencyMs" } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      summary: {
        total,
        last24h,
        fallbackCount,
        errorCount,
        byAudience: byAudience.map((item) => ({ audience: item._id || "unknown", count: item.count })),
        byProvider: byProvider.map((item) => ({
          provider: item._id || "none",
          count: item.count,
          avgLatencyMs: Math.round(Number(item.avgLatencyMs || 0)),
        })),
      },
      items,
    });
  }),
);

aiRouter.post(
  "/providers/test",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { provider } = providerTestSchema.parse(req.body);
    const descriptor = configuredProviders().find((candidate) => candidate.id === provider);
    if (!descriptor?.configured) {
      return res.json({
        ok: false,
        provider,
        message: "المزود غير مفعل. أضف مفاتيحه في Render Environment Variables ثم أعد النشر.",
      });
    }

    try {
      const startedAt = Date.now();
      const text = await callSingleProvider(provider, "اكتب جملة عربية قصيرة تؤكد أن مزود الذكاء الاصطناعي يعمل.");
      return res.json({
        ok: Boolean(text),
        provider,
        model: descriptor.model,
        latencyMs: Date.now() - startedAt,
        sample: text.slice(0, 240),
      });
    } catch (error) {
      return res.json({
        ok: false,
        provider,
        model: descriptor.model,
        message: error instanceof Error ? error.message : "تعذر اختبار المزود.",
      });
    }
  }),
);

aiRouter.post(
  "/chat",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { message } = chatSchema.parse(req.body);
    const startedAt = Date.now();
    const studentContext = await buildStudentAiContext(req.authUser?.id);
    const fallback = buildPersonalizedTutorFallback(message, studentContext);

    const prompt = `
${ARABIC_TUTOR_RULES}
بيانات الطالب من المنصة إن وجدت:
${studentContext?.summary || "الطالب غير مسجل أو لا توجد بيانات أداء متاحة."}

تعليمات مهمة:
- إذا سأل الطالب عن ضعفه أو ماذا يذاكر، استخدم بيانات أدائه أولا.
- لا تعرض بيانات حساسة، واجعل الرد كمرشد أكاديمي بسيط.
- اقترح خطوة واحدة واضحة ثم تدريب قصير.

سؤال الطالب:
${message}
`;

    try {
      const result = await callAiWithMeta(prompt);
      const responseText = result.text || fallback;
      await recordAiInteraction({
        req,
        endpoint: "/ai/chat",
        audience: req.authUser?.role || "guest",
        message,
        responseText,
        provider: result.text ? result.provider : "none",
        model: result.text ? result.model : "local-fallback",
        usedFallback: !result.text,
        personalized: Boolean(studentContext?.weaknesses.length),
        latencyMs: Date.now() - startedAt,
        metadata: {
          weaknessesCount: studentContext?.weaknesses.length || 0,
          recentResultsCount: studentContext?.recentResults.length || 0,
          providerErrors: result.errors.slice(0, 3),
        },
      });
      return res.json({
        text: responseText,
        personalized: Boolean(studentContext?.weaknesses.length),
        weaknessesCount: studentContext?.weaknesses.length || 0,
        provider: result.text ? result.provider : "none",
        model: result.text ? result.model : "local-fallback",
        usedFallback: !result.text,
      });
    } catch (error) {
      await recordAiInteraction({
        req,
        endpoint: "/ai/chat",
        audience: req.authUser?.role || "guest",
        message,
        responseText: fallback,
        provider: "none",
        model: "local-fallback",
        usedFallback: true,
        personalized: Boolean(studentContext?.weaknesses.length),
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "AI chat failed",
      });
      return res.json({
        text: fallback,
        personalized: Boolean(studentContext?.weaknesses.length),
        weaknessesCount: studentContext?.weaknesses.length || 0,
        provider: "none",
        model: "local-fallback",
        usedFallback: true,
      });
    }
  }),
);

aiRouter.post(
  "/admin-assistant",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { message } = adminAssistantSchema.parse(req.body);
    const startedAt = Date.now();
    const audit = await createOperationsAudit();
    const priorities = audit.priorities
      .slice(0, 6)
      .map((item) => `- ${item.title}: ${item.count} (${item.severity}) - ${item.action}`)
      .join("\n");
    const fallback = [
      `حالة المنصة الآن: ${audit.score}/100.`,
      audit.totals.critical > 0
        ? `ابدأ بالمشكلات الحرجة وعددها ${audit.totals.critical}.`
        : "لا توجد مشكلات حرجة حاليا.",
      priorities ? `الأولويات:\n${priorities}` : "لا توجد أولويات تشغيلية ظاهرة الآن.",
      "اقتراحي: عالج أول عنصر في القائمة، ثم اضغط فحص الآن من مركز مراقبة النظام.",
    ].join("\n\n");

    const prompt = `
أنت مساعد مدير منصة تعليمية عربية اسمها منصة المئة.
دورك مساعدة المدير غير البرمجي على فهم حالة الموقع واتخاذ قرار عملي واضح.
اكتب بالعربية، اختصر، ولا تذكر أسرار أو مفاتيح API أو كلمات مرور.
لا تنفذ أوامر بنفسك في الرد. أعط خطوات إدارة واضحة.

بيانات الفحص الحالية:
${JSON.stringify({
  score: audit.score,
  totals: audit.totals,
  priorities: audit.priorities.slice(0, 6).map((item) => ({
    title: item.title,
    severity: item.severity,
    count: item.count,
    action: item.action,
  })),
})}

سؤال المدير:
${message}
`;

    try {
      const result = await callAiWithMeta(prompt);
      const responseText = result.text || fallback;
      await recordAiInteraction({
        req,
        endpoint: "/ai/admin-assistant",
        audience: "admin",
        message,
        responseText,
        provider: result.text ? result.provider : "none",
        model: result.text ? result.model : "local-fallback",
        usedFallback: !result.text,
        latencyMs: Date.now() - startedAt,
        metadata: {
          auditScore: audit.score,
          critical: audit.totals.critical,
          warnings: audit.totals.warnings,
          providerErrors: result.errors.slice(0, 3),
        },
      });
      return res.json({
        text: responseText,
        audit: {
          score: audit.score,
          totals: audit.totals,
          priorities: audit.priorities.slice(0, 6),
        },
        provider: result.text ? result.provider : "none",
      });
    } catch (error) {
      await recordAiInteraction({
        req,
        endpoint: "/ai/admin-assistant",
        audience: "admin",
        message,
        responseText: fallback,
        provider: "none",
        model: "local-fallback",
        usedFallback: true,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "AI admin assistant failed",
        metadata: {
          auditScore: audit.score,
          critical: audit.totals.critical,
          warnings: audit.totals.warnings,
        },
      });
      return res.json({
        text: fallback,
        audit: {
          score: audit.score,
          totals: audit.totals,
          priorities: audit.priorities.slice(0, 6),
        },
        provider: "none",
      });
    }
  }),
);

aiRouter.post(
  "/study-plan",
  asyncHandler(async (req, res) => {
    const { weaknesses } = studyPlanSchema.parse(req.body);
    const fallback = {
      steps: [
        "راجع شرح المهارة الأساسية في فيديو قصير.",
        "حل 10 أسئلة متدرجة من السهل إلى المتوسط.",
        "أعد اختبارًا قصيرًا للتأكد من التحسن.",
      ],
    };

    const prompt = `
${ARABIC_TUTOR_RULES}
ضع خطة مذاكرة قصيرة من 3 خطوات لطالب لديه ضعف في:
${weaknesses.join(", ") || "مهارات عامة"}
أعد JSON فقط بالشكل التالي:
{"steps":["...","...","..."]}
`;

    try {
      const text = await callAi(prompt, "application/json");
      return res.json(safeJsonParse(text, fallback));
    } catch {
      return res.json(fallback);
    }
  }),
);

aiRouter.post(
  "/learning-path",
  asyncHandler(async (req, res) => {
    const { skills } = learningPathSchema.parse(req.body);
    const targetSkills = skills.filter((skill) => skill.status === "weak" || skill.status === "average").slice(0, 5);
    const fallback = targetSkills.slice(0, 3).map((skill, index) => ({
      id: `rec_${index + 1}`,
      type: index === 1 ? "quiz" : "lesson",
      title: `مراجعة ${skill.skill || skill.name || "مهارة مهمة"}`,
      duration: index === 1 ? "10 دقائق" : "15 دقيقة",
      reason: `لأن مستوى الإتقان يحتاج دعمًا في ${skill.skill || skill.name || "هذه المهارة"}.`,
      skillTargeted: skill.skill || skill.name || "مهارة مستهدفة",
      priority: skill.status === "weak" ? "high" : "medium",
      actionLabel: index === 1 ? "ابدأ التدريب" : "ابدأ الدرس",
      link: "/dashboard",
    }));

    if (targetSkills.length === 0) {
      return res.json([]);
    }

    const prompt = `
${ARABIC_TUTOR_RULES}
حلل فجوات المهارات التالية لطالب عربي:
${JSON.stringify(targetSkills)}
اقترح 3 خطوات تعلم عملية. أعد JSON array فقط بهذه المفاتيح:
id,type,title,duration,reason,skillTargeted,priority,actionLabel,link
type واحد من lesson أو quiz أو flashcard. priority واحد من high أو medium أو low.
`;

    try {
      const text = await callAi(prompt, "application/json");
      const parsed = safeJsonParse(text, fallback);
      return res.json(Array.isArray(parsed) ? parsed : fallback);
    } catch {
      return res.json(fallback);
    }
  }),
);

aiRouter.post(
  "/remediation-plan",
  asyncHandler(async (req, res) => {
    const { skills, ageBand } = remediationPlanSchema.parse(req.body);
    const targetSkills = skills
      .filter((skill) => skill.status === "weak" || skill.status === "average" || Number(skill.mastery || 0) < 75)
      .slice(0, 3);
    const fallback = {
      title: "خطة علاجية قصيرة",
      summary: "ابدأ بأضعف مهارة، راجع شرحًا بسيطًا، ثم حل تدريبًا قصيرًا وأعد القياس.",
      steps: targetSkills.length
        ? targetSkills.map((skill, index) => ({
            day: `اليوم ${index + 1}`,
            skill: formatSkillContext(skill),
            action: index === 0 ? "راجع شرحًا قصيرًا ثم حل 5 أسئلة سهلة." : "حل تدريبًا متدرجًا ثم راجع الأخطاء.",
            check: "أعد اختبارًا مصغرًا من 5 أسئلة على نفس المهارة.",
          }))
        : [
            {
              day: "اليوم 1",
              skill: "مراجعة عامة",
              action: "حل اختبار تشخيصي قصير لتحديد أول مهارة تحتاج علاجًا.",
              check: "راجع نتيجة الاختبار وحدد أضعف مهارة.",
            },
          ],
      parentNote: "تابع التقدم بهدوء. المطلوب الآن خطوة صغيرة يوميًا وليس ضغطًا زائدًا.",
    };

    const prompt = `
${ARABIC_TUTOR_RULES}
ابن خطة علاجية تعليمية قصيرة للطالب حسب الفئة العمرية: ${ageBand}.
المهارات الضعيفة أو المتوسطة:
${JSON.stringify(targetSkills)}
أعد JSON فقط بالشكل التالي:
{"title":"...","summary":"...","steps":[{"day":"...","skill":"...","action":"...","check":"..."}],"parentNote":"..."}
`;

    try {
      const text = await callAi(prompt, "application/json");
      const parsed = safeJsonParse(text, fallback);
      return res.json(parsed);
    } catch {
      return res.json(fallback);
    }
  }),
);

aiRouter.post(
  "/question",
  asyncHandler(async (req, res) => {
    const { topic } = questionSchema.parse(req.body);
    const fallback = {
      question: `سؤال تدريبي في ${topic}: أي اختيار يمثل الفكرة الصحيحة؟`,
      options: ["الاختيار الأول", "الاختيار الثاني", "الاختيار الثالث", "الاختيار الرابع"],
      correctIndex: 0,
      explanation: "هذا سؤال مبدئي. راجع السؤال قبل نشره للطلاب.",
    };

    const prompt = `
${ARABIC_TUTOR_RULES}
أنشئ سؤال اختيار من متعدد باللغة العربية عن:
${topic}
يفضل أن يكون مناسبًا لمنصة قدرات/تحصيلي.
أعد JSON فقط:
{"question":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}
`;

    try {
      const text = await callAi(prompt, "application/json");
      return res.json(safeJsonParse(text, fallback));
    } catch {
      return res.json(fallback);
    }
  }),
);

aiRouter.post(
  "/course-summary",
  asyncHandler(async (req, res) => {
    const { courseTitle } = courseSummarySchema.parse(req.body);
    const fallback = `هذه الدورة تساعدك على فهم ${courseTitle} بخطوات منظمة وتدريبات تدريجية حتى تصل للإتقان.`;

    const prompt = `
${ARABIC_TUTOR_RULES}
اكتب ملخصًا عربيًا قصيرًا جدًا من جملتين لدورة تعليمية عنوانها:
${courseTitle}
اجعله بسيطًا ومشجعًا للطالب.
`;

    try {
      const text = await callAi(prompt);
      return res.json({ text: text || fallback });
    } catch {
      return res.json({ text: fallback });
    }
  }),
);

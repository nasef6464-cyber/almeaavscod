import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { USE_PG } from "../utils/usePg.js";
import { db } from "../db/connection.js";
import { aiInteractions } from "../db/schema/index.js";
import { desc, sql } from "drizzle-orm";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
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
type AiProvider = "gemini" | "ollama" | "lmstudio" | "deepseek" | "none";

const isOllamaExplicitlyConfigured = () =>
  Boolean(process.env.AI_PROVIDER === "ollama" || process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL);
const isLmStudioExplicitlyConfigured = () =>
  Boolean(process.env.AI_PROVIDER === "lmstudio" || process.env.LM_STUDIO_BASE_URL || process.env.LM_STUDIO_MODEL);
const isDeepSeekExplicitlyConfigured = () =>
  Boolean(process.env.AI_PROVIDER === "deepseek" || process.env.DEEPSEEK_API_KEY);

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

const resolveProvider = (): AiProvider => {
  if (env.AI_PROVIDER) return env.AI_PROVIDER;
  if (env.DEEPSEEK_API_KEY) return "deepseek";
  if (env.GEMINI_API_KEY) return "gemini";
  if (isOllamaExplicitlyConfigured() && env.OLLAMA_BASE_URL && env.OLLAMA_MODEL) return "ollama";
  if (isLmStudioExplicitlyConfigured() && env.LM_STUDIO_BASE_URL && env.LM_STUDIO_MODEL) return "lmstudio";
  return "none";
};

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

const callDeepSeek = async (prompt: string, responseMimeType?: AiResponseMimeType) => {
  if (!env.DEEPSEEK_API_KEY) return "";

  const response = await fetchWithTimeout(`${env.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: responseMimeType === "application/json" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content?.trim() || "";
};

const callAi = async (prompt: string, responseMimeType?: AiResponseMimeType) => {
  const provider = resolveProvider();

  if (provider === "deepseek") {
    try {
      return await callDeepSeek(prompt, responseMimeType);
    } catch (error) {
      if (env.GEMINI_API_KEY) {
        return callGemini(prompt, responseMimeType);
      }
      throw error;
    }
  }

  if (provider === "ollama") {
    try {
      return await callOllama(prompt, responseMimeType);
    } catch (error) {
      if (env.GEMINI_API_KEY) {
        return callGemini(prompt, responseMimeType);
      }
      throw error;
    }
  }

  if (provider === "lmstudio") {
    try {
      return await callLmStudio(prompt, responseMimeType);
    } catch (error) {
      if (env.GEMINI_API_KEY) {
        return callGemini(prompt, responseMimeType);
      }
      throw error;
    }
  }

  if (provider === "gemini") {
    return callGemini(prompt, responseMimeType);
  }

  return "";
};

export const aiRouter = Router();

aiRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const provider = resolveProvider();
    res.json({
      provider,
      ollamaConfigured: isOllamaExplicitlyConfigured() && Boolean(env.OLLAMA_BASE_URL && env.OLLAMA_MODEL),
      lmStudioConfigured: isLmStudioExplicitlyConfigured() && Boolean(env.LM_STUDIO_BASE_URL && env.LM_STUDIO_MODEL),
      deepseekConfigured: isDeepSeekExplicitlyConfigured() && Boolean(env.DEEPSEEK_API_KEY),
      geminiConfigured: Boolean(env.GEMINI_API_KEY),
      model: provider === "deepseek" ? env.DEEPSEEK_MODEL : provider === "ollama" ? env.OLLAMA_MODEL : provider === "lmstudio" ? env.LM_STUDIO_MODEL : env.GEMINI_MODEL,
      timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
    });
  }),
);

aiRouter.post(
  "/chat",
  asyncHandler(async (req, res) => {
    const { message } = chatSchema.parse(req.body);
    const fallback =
      "أنا معك. اكتب السؤال أو المهارة التي تريد فهمها، وسأقترح لك خطوة بسيطة: راجع الفكرة، حل مثالًا قصيرًا، ثم جرب سؤالًا مشابهًا.";

    const prompt = `
${ARABIC_TUTOR_RULES}
سؤال الطالب:
${message}
`;

    try {
      const answer = await callAi(prompt);
      return res.json({ text: answer || fallback });
    } catch {
      return res.json({ text: fallback });
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

aiRouter.get(
  "/readiness",
  asyncHandler(async (_req, res) => {
    const provider = resolveProvider();
    const ready = provider !== "none";
    return res.json({
      ready,
      provider,
      message: ready ? "AI provider is configured" : "No AI provider configured. Set GEMINI_API_KEY or AI_PROVIDER.",
    });
  }),
);

aiRouter.post(
  "/providers/test",
  asyncHandler(async (_req, res) => {
    const provider = resolveProvider();
    if (provider === "none") {
      return res.json({ success: false, message: "No AI provider configured" });
    }
    try {
      const result = await callAi("رد بكلمة واحدة: تمام");
      return res.json({ success: true, message: result || "Provider responded" });
    } catch (err: any) {
      return res.json({ success: false, message: err?.message || "Provider test failed" });
    }
  }),
);

aiRouter.post(
  "/admin-assistant",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const schema = z.object({ message: z.string().min(1).max(3000) });
    const { message } = schema.parse(req.body);
    const prompt = `${ARABIC_TUTOR_RULES}\nأنت مساعد أدمن للمنصة التعليمية. أجب عن الاستفسار الإداري التالي:\n${message}`;
    try {
      const answer = await callAi(prompt);
      return res.json({ text: answer || "لم أتمكن من معالجة الطلب." });
    } catch {
      return res.json({ text: "عذرًا، حدث خطأ في معالجة الطلب." });
    }
  }),
);

aiRouter.get(
  "/interactions",
  requireAuth,
  requireRole(["admin"]),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50 } = req.query as any;
    const skip = (Number(page) - 1) * Number(limit);
    if (USE_PG()) {
      const [data, totalResult] = await Promise.all([
        db.select().from(aiInteractions).orderBy(desc(aiInteractions.createdAt)).limit(Number(limit)).offset(skip),
        db.select({ count: sql`count(*)` }).from(aiInteractions),
      ]);
      return res.json({ interactions: data, total: Number(totalResult[0]?.count || 0) });
    }
    return res.json({ interactions: [], total: 0 });
  }),
);

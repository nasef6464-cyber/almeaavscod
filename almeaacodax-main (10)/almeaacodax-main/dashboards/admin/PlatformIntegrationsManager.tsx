import React, { useEffect, useMemo, useState } from "react";
import { Save, ShieldCheck, Link2, UserRoundPlus, Plus, Trash2, Search, Radio, RefreshCw, ExternalLink, Copy } from "lucide-react";
import { api } from "../../services/api";

type ProviderConfig = {
  enabled: boolean;
  mode: string;
  appId?: string;
  appSecret?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  accessToken?: string;
  callbackUrl?: string;
  fromEmail?: string;
  senderName?: string;
  botUsername?: string;
  botToken?: string;
  chatId?: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  verifyToken?: string;
  webhookUrl?: string;
  note?: string;
};

type RegistrationField = {
  id: string;
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "select" | "textarea";
  required: boolean;
  enabled: boolean;
  options: string[];
  placeholder: string;
  helpText: string;
  order: number;
};

type ExternalPlatform = {
  id: string;
  name: string;
  enabled: boolean;
  platformType: "lms" | "marketplace" | "crm" | "custom";
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string;
  webhookSecret: string;
  syncStudents: boolean;
  syncCourses: boolean;
  syncOrders: boolean;
  syncScheduleCron: string;
  note: string;
};

type IntegrationSettings = {
  key: string;
  auth: {
    allowSelfRegistration: boolean;
    allowEmailPassword: boolean;
    requireEmailVerification: boolean;
    requireAdminApproval: boolean;
    defaultRole: "student" | "parent";
    registrationTitle: string;
    registrationSubtitle: string;
    termsLink: string;
    privacyLink: string;
    maxAccountsPerDevice: number;
    allowedEmailDomains: string[];
  };
  providers: {
    google: ProviderConfig;
    facebook: ProviderConfig;
    whatsapp: ProviderConfig;
    telegram: ProviderConfig;
    email: ProviderConfig;
    sentry: ProviderConfig;
    redis: ProviderConfig;
    zoom: ProviderConfig;
    googleMeet: ProviderConfig;
    teams: ProviderConfig;
    youtubeLive: ProviderConfig;
  };
  seo: {
    enabled: boolean;
    siteName: string;
    defaultTitle: string;
    defaultDescription: string;
    defaultKeywords: string[];
    canonicalBaseUrl: string;
    defaultOgImage: string;
    twitterHandle: string;
    googleSiteVerification: string;
    googleAnalyticsId: string;
    googleTagManagerId: string;
    robotsIndexingEnabled: boolean;
    noIndexPaths: string[];
    organizationName: string;
    organizationLogoUrl: string;
    organizationUrl: string;
  };
  contactWidget: {
    enabled: boolean;
    channel: "whatsapp" | "telegram" | "phone";
    whatsappNumber: string;
    whatsappMessage: string;
    openInNewTab: boolean;
    showOnPublicPages: boolean;
    showOnDashboardPages: boolean;
  };
  externalPlatforms: ExternalPlatform[];
  registrationFields: RegistrationField[];
  providerSecretState?: Record<string, Partial<Record<"appSecret" | "clientSecret" | "apiKey" | "accessToken" | "botToken" | "verifyToken", boolean>>>;
};

type IntegrationHistoryItem = {
  _id: string;
  updatedBy?: string;
  note?: string;
  createdAt?: string;
};

type SetupChecklist = {
  publicBaseUrl: string;
  apiBaseUrl: string;
  summary: { total: number; enabled: number; configuredEnabled: number; blockers: string[] };
  checks: Array<{
    id: string;
    title: string;
    envKeys: string[];
    callbackUrl: string;
    webhookUrl: string;
    enabled: boolean;
    isConfigured: boolean;
    notes: string;
  }>;
};

type RuntimeAudit = {
  summary: { total: number; enabled: number; runtimeReady: number; blocked: string[] };
  items: Array<{
    id: string;
    title: string;
    enabled: boolean;
    dbConfigured: boolean;
    envConfigured: boolean;
    runtimeReady: boolean;
    health?: { ok: boolean; status: string; latencyMs: number | null; error: string };
  }>;
};

const emptySettings: IntegrationSettings = {
  key: "default",
  auth: {
    allowSelfRegistration: true,
    allowEmailPassword: true,
    requireEmailVerification: false,
    requireAdminApproval: false,
    defaultRole: "student",
    registrationTitle: "",
    registrationSubtitle: "",
    termsLink: "",
    privacyLink: "",
    maxAccountsPerDevice: 3,
    allowedEmailDomains: [],
  },
  providers: {
    google: { enabled: false, mode: "oauth" },
    facebook: { enabled: false, mode: "oauth" },
    whatsapp: { enabled: false, mode: "otp" },
    telegram: { enabled: false, mode: "bot" },
    email: { enabled: false, mode: "smtp" },
    sentry: { enabled: false, mode: "dsn" },
    redis: { enabled: false, mode: "managed" },
    zoom: { enabled: false, mode: "oauth" },
    googleMeet: { enabled: false, mode: "oauth" },
    teams: { enabled: false, mode: "oauth" },
    youtubeLive: { enabled: false, mode: "api" },
  },
  seo: {
    enabled: true,
    siteName: "منصة المئة",
    defaultTitle: "",
    defaultDescription: "",
    defaultKeywords: [],
    canonicalBaseUrl: "",
    defaultOgImage: "",
    twitterHandle: "",
    googleSiteVerification: "",
    googleAnalyticsId: "",
    googleTagManagerId: "",
    robotsIndexingEnabled: true,
    noIndexPaths: ["/#/admin-dashboard", "/#/dashboard", "/#/login"],
    organizationName: "",
    organizationLogoUrl: "",
    organizationUrl: "",
  },
  contactWidget: {
    enabled: true,
    channel: "whatsapp",
    whatsappNumber: "",
    whatsappMessage: "مرحبًا، أريد الاستفسار عن منصة المئة.",
    openInNewTab: true,
    showOnPublicPages: true,
    showOnDashboardPages: false,
  },
  externalPlatforms: [],
  registrationFields: [],
};

const createField = (index: number): RegistrationField => ({
  id: `field_${Date.now()}_${index}`,
  key: `custom_${index + 1}`,
  label: "حقل جديد",
  type: "text",
  required: false,
  enabled: true,
  options: [],
  placeholder: "",
  helpText: "",
  order: index,
});

const createExternalPlatform = (index: number): ExternalPlatform => ({
  id: `platform_${Date.now()}_${index}`,
  name: `منصة خارجية ${index + 1}`,
  enabled: false,
  platformType: "custom",
  baseUrl: "",
  apiKey: "",
  apiSecret: "",
  webhookUrl: "",
  webhookSecret: "",
  syncStudents: false,
  syncCourses: false,
  syncOrders: false,
  syncScheduleCron: "",
  note: "",
});

const providerLabels: Array<{ key: keyof IntegrationSettings["providers"]; label: string }> = [
  { key: "google", label: "Google Login" },
  { key: "facebook", label: "Facebook Login" },
  { key: "whatsapp", label: "WhatsApp OTP" },
  { key: "telegram", label: "Telegram Login/OTP" },
  { key: "email", label: "Email Provider" },
  { key: "sentry", label: "Sentry Monitoring" },
  { key: "redis", label: "Redis Managed" },
  { key: "zoom", label: "Zoom Live Classes" },
  { key: "googleMeet", label: "Google Meet Classes" },
  { key: "teams", label: "Microsoft Teams Classes" },
  { key: "youtubeLive", label: "YouTube Live Streams" },
];

const providerGuides: Record<
  keyof IntegrationSettings["providers"],
  {
    sourceLabel: string;
    sourceUrl: string;
    fieldsHelp: string[];
    notes: string[];
    callbackPath?: string;
    webhookPath?: string;
  }
> = {
  google: {
    sourceLabel: "Google Cloud Console",
    sourceUrl: "https://console.cloud.google.com/apis/credentials",
    fieldsHelp: [
      "Client ID -> ضعها في خانة Client ID",
      "Client Secret -> ضعها في خانة Client Secret",
      "Redirect URI -> ضعها في خانة Callback URL",
    ],
    notes: ["نوع التطبيق: Web application", "فعّل Google Identity/OAuth consent screen"],
    callbackPath: "/api/auth/google/callback",
  },
  facebook: {
    sourceLabel: "Meta Developers",
    sourceUrl: "https://developers.facebook.com/apps/",
    fieldsHelp: [
      "App ID -> ضعها في App ID",
      "App Secret -> ضعها في Client Secret",
      "Valid OAuth Redirect URI -> ضعها في Callback URL",
    ],
    notes: ["أضف النطاق في App Domains", "فعّل Facebook Login (Web)"],
    callbackPath: "/api/auth/facebook/callback",
  },
  whatsapp: {
    sourceLabel: "Meta WhatsApp Cloud API",
    sourceUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/",
    fieldsHelp: [
      "Access Token -> ضعها في Access Token",
      "Phone Number ID -> ضعها في Phone Number ID",
      "Business Account ID -> ضعها في Business Account ID",
      "Verify Token -> ضعها في Verify Token",
      "Webhook URL -> ضعها في Webhook URL",
    ],
    notes: ["الرقم يكون دولي بدون 00 في الإعدادات العامة للزر العائم", "اختبر Webhook من Meta dashboard"],
    webhookPath: "/api/webhooks/whatsapp",
  },
  telegram: {
    sourceLabel: "Telegram BotFather",
    sourceUrl: "https://t.me/BotFather",
    fieldsHelp: [
      "Bot Token -> ضعها في Access Token أو Bot Token",
      "Bot Username -> ضعها في Bot Username",
      "Webhook URL -> ضعها في Webhook URL",
    ],
    notes: ["استخدم /setdomain و /setprivacy عند الحاجة"],
    webhookPath: "/api/webhooks/telegram",
  },
  email: {
    sourceLabel: "Email Provider Dashboard",
    sourceUrl: "https://resend.com/",
    fieldsHelp: [
      "API Key -> ضعها في API Key",
      "From Email -> ضعها في From Email",
      "Sender Name -> ضعها في Sender Name",
    ],
    notes: ["يمكن التبديل بين Resend/SendGrid/Mailgun حسب البنية الخلفية"],
  },
  sentry: {
    sourceLabel: "Sentry Project Settings",
    sourceUrl: "https://sentry.io/settings/",
    fieldsHelp: ["DSN -> ضعها في Access Token (DSN)", "Environment -> يوضع في متغيرات الخادم"],
    notes: ["يفضل تفعيل release tracking"],
  },
  redis: {
    sourceLabel: "Upstash / Redis Cloud",
    sourceUrl: "https://console.upstash.com/",
    fieldsHelp: ["Redis URL -> ضعها في Access Token (أو REDIS_URL في env)"],
    notes: ["مطلوبة للـqueue + distributed rate limit"],
  },
  zoom: {
    sourceLabel: "Zoom Marketplace",
    sourceUrl: "https://marketplace.zoom.us/",
    fieldsHelp: [
      "Client ID -> خانة Client ID",
      "Client Secret -> خانة Client Secret",
      "Redirect URL -> خانة Callback URL",
    ],
    notes: ["نوع التطبيق: OAuth"],
    callbackPath: "/api/auth/zoom/callback",
  },
  googleMeet: {
    sourceLabel: "Google Cloud (Calendar/Meet scopes)",
    sourceUrl: "https://console.cloud.google.com/apis/credentials",
    fieldsHelp: ["Client ID", "Client Secret", "Callback URL"],
    notes: ["فعّل Google Calendar API وصلاحيات إنشاء الاجتماعات"],
    callbackPath: "/api/auth/google-meet/callback",
  },
  teams: {
    sourceLabel: "Microsoft Entra Admin Center",
    sourceUrl: "https://entra.microsoft.com/",
    fieldsHelp: ["Application (client) ID", "Client Secret", "Redirect URI (Callback URL)"],
    notes: ["فعّل صلاحيات Teams/Graph المناسبة"],
    callbackPath: "/api/auth/teams/callback",
  },
  youtubeLive: {
    sourceLabel: "Google Cloud (YouTube Data API)",
    sourceUrl: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    fieldsHelp: ["API Key أو OAuth حسب التدفق", "Callback URL عند استخدام OAuth"],
    notes: ["فعّل YouTube Data API v3"],
    callbackPath: "/api/auth/youtube/callback",
  },
};

export const PlatformIntegrationsManager: React.FC = () => {
  const [settings, setSettings] = useState<IntegrationSettings>(emptySettings);
  const [history, setHistory] = useState<IntegrationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [setupChecklist, setSetupChecklist] = useState<SetupChecklist | null>(null);
  const [runtimeAudit, setRuntimeAudit] = useState<RuntimeAudit | null>(null);
  const [readiness, setReadiness] = useState<null | {
    status: string;
    score: number;
    checks: Array<{ id: string; title: string; status: "pass" | "warning" | "fail"; detail: string }>;
  }>(null);
  const [openGuideFor, setOpenGuideFor] = useState<keyof IntegrationSettings["providers"] | null>(null);
  const [testChannel, setTestChannel] = useState<"email" | "whatsapp">("email");
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("هذه رسالة اختبار من منصة المئة.");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getPlatformIntegrations()
      .then((payload) => {
        if (cancelled) return;
        setSettings({ ...emptySettings, ...(payload as IntegrationSettings) });
      })
      .catch((error) => {
        if (cancelled) return;
        setStatusType("error");
        setStatusMessage(error instanceof Error ? error.message : "تعذر تحميل إعدادات التكاملات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledProvidersCount = useMemo(
    () => Object.values(settings.providers).filter((provider) => provider.enabled).length,
    [settings.providers],
  );

  const updateAuth = <K extends keyof IntegrationSettings["auth"]>(key: K, value: IntegrationSettings["auth"][K]) => {
    setSettings((prev) => ({ ...prev, auth: { ...prev.auth, [key]: value } }));
  };

  const updateProvider = (providerKey: keyof IntegrationSettings["providers"], patch: Partial<ProviderConfig>) => {
    setSettings((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerKey]: {
          ...prev.providers[providerKey],
          ...patch,
        },
      },
    }));
  };

  const updateSeo = <K extends keyof IntegrationSettings["seo"]>(key: K, value: IntegrationSettings["seo"][K]) => {
    setSettings((prev) => ({ ...prev, seo: { ...prev.seo, [key]: value } }));
  };
  const updateContactWidget = <K extends keyof IntegrationSettings["contactWidget"]>(
    key: K,
    value: IntegrationSettings["contactWidget"][K],
  ) => {
    setSettings((prev) => ({ ...prev, contactWidget: { ...prev.contactWidget, [key]: value } }));
  };

  const updateField = (id: string, patch: Partial<RegistrationField>) => {
    setSettings((prev) => ({
      ...prev,
      registrationFields: prev.registrationFields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    }));
  };

  const addField = () => {
    setSettings((prev) => ({
      ...prev,
      registrationFields: [...prev.registrationFields, createField(prev.registrationFields.length)],
    }));
  };

  const removeField = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      registrationFields: prev.registrationFields.filter((field) => field.id !== id),
    }));
  };

  const updateExternal = (id: string, patch: Partial<ExternalPlatform>) => {
    setSettings((prev) => ({
      ...prev,
      externalPlatforms: prev.externalPlatforms.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const addExternal = () => {
    setSettings((prev) => ({
      ...prev,
      externalPlatforms: [...prev.externalPlatforms, createExternalPlatform(prev.externalPlatforms.length)],
    }));
  };

  const removeExternal = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      externalPlatforms: prev.externalPlatforms.filter((item) => item.id !== id),
    }));
  };

  const loadReadiness = async () => {
    try {
      const payload = await api.getIntegrationsReadiness();
      setReadiness(payload);
    } catch {
      setReadiness(null);
    }
  };

  const loadSetupChecklist = async () => {
    try {
      const payload = await api.getPlatformIntegrationsSetupChecklist();
      setSetupChecklist(payload);
    } catch {
      setSetupChecklist(null);
    }
  };

  const loadRuntimeAudit = async () => {
    try {
      const payload = await api.getPlatformIntegrationsRuntimeAudit();
      setRuntimeAudit(payload);
    } catch {
      setRuntimeAudit(null);
    }
  };

  const loadHistory = async () => {
    try {
      const payload = await api.getPlatformIntegrationsHistory();
      setHistory(Array.isArray(payload.history) ? payload.history : []);
    } catch {
      setHistory([]);
    }
  };

  const restoreSnapshot = async (snapshotId: string) => {
    setRestoringId(snapshotId);
    setStatusMessage("");
    try {
      const restored = await api.restorePlatformIntegrationsHistory(snapshotId);
      setSettings({ ...emptySettings, ...(restored.settings as IntegrationSettings) });
      setStatusType("success");
      setStatusMessage("تم استرجاع إعدادات التكاملات بنجاح.");
      await Promise.all([loadReadiness(), loadHistory(), loadSetupChecklist(), loadRuntimeAudit()]);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(error instanceof Error ? error.message : "تعذر استرجاع النسخة.");
    } finally {
      setRestoringId(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setStatusMessage("");
    try {
      const normalized = {
        ...settings,
        auth: {
          ...settings.auth,
          allowedEmailDomains: settings.auth.allowedEmailDomains.filter(Boolean),
        },
        seo: {
          ...settings.seo,
          defaultKeywords: settings.seo.defaultKeywords.filter(Boolean),
          noIndexPaths: settings.seo.noIndexPaths.filter(Boolean),
        },
        registrationFields: settings.registrationFields.map((field, index) => ({
          ...field,
          order: index,
          key: field.key.trim(),
          label: field.label.trim(),
          options: field.options.filter(Boolean),
        })),
        externalPlatforms: settings.externalPlatforms.map((item) => ({
          ...item,
          name: item.name.trim(),
          baseUrl: item.baseUrl.trim(),
        })),
      };
      const updated = (await api.updatePlatformIntegrations(normalized)) as IntegrationSettings;
      setSettings({ ...emptySettings, ...updated });
      setStatusType("success");
      setStatusMessage("تم حفظ إعدادات التكاملات والتسجيل وSEO بنجاح.");
      await Promise.all([loadReadiness(), loadHistory(), loadSetupChecklist(), loadRuntimeAudit()]);
    } catch (error) {
      setStatusType("error");
      setStatusMessage(error instanceof Error ? error.message : "تعذر حفظ الإعدادات.");
    } finally {
      setSaving(false);
    }
  };

  const recommendedPublicBase = useMemo(() => {
    const bySeo = String(settings.seo.canonicalBaseUrl || "").trim();
    if (bySeo) return bySeo.replace(/\/+$/, "");
    if (typeof window !== "undefined" && window.location?.origin) return window.location.origin.replace(/\/+$/, "");
    return "https://your-domain.com";
  }, [settings.seo.canonicalBaseUrl]);

  const suggestedUrl = (path?: string) => (path ? `${recommendedPublicBase}${path}` : "");

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setStatusType("success");
      setStatusMessage("تم نسخ الرابط.");
    } catch {
      setStatusType("error");
      setStatusMessage("تعذر النسخ، انسخه يدويًا.");
    }
  };

  const sendIntegrationTest = async () => {
    setSendingTest(true);
    setTestResult("");
    try {
      const payload =
        testChannel === "email"
          ? { channel: "email" as const, recipientEmail: testEmail, title: "اختبار البريد", subject: "اختبار البريد", body: testMessage }
          : { channel: "whatsapp" as const, recipientPhone: testPhone, title: "اختبار واتساب", subject: "اختبار واتساب", body: testMessage };
      const result = await api.testIntegrationDelivery(payload);
      if (result.ok) {
        setTestResult(`نجح الاختبار عبر ${result.provider}${result.providerMessageId ? ` - ${result.providerMessageId}` : ""}`);
      } else {
        setTestResult(`فشل الاختبار: ${result.failureReason || "provider_error"}`);
      }
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : "تعذر تنفيذ اختبار الإرسال.");
    } finally {
      setSendingTest(false);
    }
  };

  useEffect(() => {
    void loadReadiness();
    void loadHistory();
    void loadSetupChecklist();
    void loadRuntimeAudit();
  }, []);

  if (loading) {
    return <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">جاري تحميل إعدادات التكاملات...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-gray-900">إدارة التكاملات والتسجيل</h2>
            <p className="mt-1 text-sm text-gray-500">تحكم كامل على نمط WordPress: مفاتيح المشاريع، بوابات الدخول، SEO، ومنصات خارجية.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadReadiness()} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700">
              <RefreshCw size={16} />
              فحص الجاهزية
            </button>
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
            </button>
          </div>
        </div>
        {statusMessage ? (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${statusType === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {statusMessage}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-700">
            <ShieldCheck size={18} />
            <span className="text-sm font-black">سياسات التسجيل</span>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">{settings.auth.allowSelfRegistration ? "مفتوح" : "مقفل"}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Link2 size={18} />
            <span className="text-sm font-black">التكاملات المفعلة</span>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">{enabledProvidersCount}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-700">
            <UserRoundPlus size={18} />
            <span className="text-sm font-black">حقول التسجيل</span>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">{settings.registrationFields.length}</div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-gray-700">
            <Search size={18} />
            <span className="text-sm font-black">حالة SEO</span>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">{settings.seo.enabled ? "مفعل" : "متوقف"}</div>
        </div>
      </div>

      {readiness ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <h3 className="text-lg font-black text-gray-900">جاهزية التكاملات</h3>
          <p className="mt-1 text-sm text-gray-500">الحالة: {readiness.status} - الدرجة: {readiness.score}/100</p>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {readiness.checks.map((check) => (
              <div key={check.id} className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
                <div className="font-black">{check.title}</div>
                <div className={`${check.status === "pass" ? "text-emerald-700" : check.status === "warning" ? "text-amber-700" : "text-rose-700"}`}>{check.status}</div>
                <div className="text-gray-500">{check.detail}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h3 className="text-lg font-black text-gray-900">إعدادات التسجيل الأساسية</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>السماح بالتسجيل الذاتي</span>
            <input type="checkbox" checked={settings.auth.allowSelfRegistration} onChange={(e) => updateAuth("allowSelfRegistration", e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>السماح بالبريد وكلمة المرور</span>
            <input type="checkbox" checked={settings.auth.allowEmailPassword} onChange={(e) => updateAuth("allowEmailPassword", e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>تفعيل تحقق البريد</span>
            <input type="checkbox" checked={settings.auth.requireEmailVerification} onChange={(e) => updateAuth("requireEmailVerification", e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>موافقة الإدارة قبل التفعيل</span>
            <input type="checkbox" checked={settings.auth.requireAdminApproval} onChange={(e) => updateAuth("requireAdminApproval", e.target.checked)} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h3 className="text-lg font-black text-gray-900">مزودو التكاملات</h3>
        <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-800">
          <div className="font-black">الدومين الحالي المقترح للروابط:</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="truncate">{recommendedPublicBase}</code>
            <button onClick={() => void copyText(recommendedPublicBase)} className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-white px-2 py-1">
              <Copy size={12} />
              نسخ
            </button>
          </div>
          <div className="mt-2">عند نقل المنصة لاستضافة جديدة، غيّر Canonical Base URL في SEO ثم استخدم نفس الأزرار لنسخ الروابط الجديدة تلقائيًا.</div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {providerLabels.map((provider) => (
            <div key={provider.key} className="rounded-xl border border-gray-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-black text-gray-900">{provider.label}</h4>
                <div className="flex items-center gap-2">
                  <button onClick={() => setOpenGuideFor(provider.key)} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs">
                    <ExternalLink size={12} />
                    فتح دليل الإعداد
                  </button>
                  <input type="checkbox" checked={settings.providers[provider.key].enabled} onChange={(e) => updateProvider(provider.key, { enabled: e.target.checked })} />
                </div>
              </div>
              {settings.providerSecretState?.[provider.key] ? (
                <div className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  توجد مفاتيح سرية محفوظة لهذا المزود. اترك حقل السر فارغًا إذا لا تريد تغييره.
                </div>
              ) : null}
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].mode || ""} onChange={(e) => updateProvider(provider.key, { mode: e.target.value })} placeholder="mode" />
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].appId || ""} onChange={(e) => updateProvider(provider.key, { appId: e.target.value })} placeholder="App ID / Project ID" />
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].clientId || ""} onChange={(e) => updateProvider(provider.key, { clientId: e.target.value })} placeholder="Client ID" />
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].clientSecret || ""} onChange={(e) => updateProvider(provider.key, { clientSecret: e.target.value })} placeholder="Client Secret / API Secret" />
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].apiKey || ""} onChange={(e) => updateProvider(provider.key, { apiKey: e.target.value })} placeholder="API Key" />
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].accessToken || ""} onChange={(e) => updateProvider(provider.key, { accessToken: e.target.value })} placeholder="Access Token / DSN / Redis URL" />
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].callbackUrl || ""} onChange={(e) => updateProvider(provider.key, { callbackUrl: e.target.value })} placeholder="Callback URL" />
              <input className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" value={settings.providers[provider.key].webhookUrl || ""} onChange={(e) => updateProvider(provider.key, { webhookUrl: e.target.value })} placeholder="Webhook URL" />
              <textarea className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={2} value={settings.providers[provider.key].note || ""} onChange={(e) => updateProvider(provider.key, { note: e.target.value })} placeholder="ملاحظات تشغيلية" />
              {(providerGuides[provider.key].callbackPath || providerGuides[provider.key].webhookPath) ? (
                <div className="mt-2 space-y-1 text-xs">
                  {providerGuides[provider.key].callbackPath ? (
                    <div className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1">
                      <span className="text-gray-500">Callback URL:</span>
                      <button onClick={() => void copyText(suggestedUrl(providerGuides[provider.key].callbackPath))} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5">
                        <Copy size={11} />
                        نسخ
                      </button>
                    </div>
                  ) : null}
                  {providerGuides[provider.key].webhookPath ? (
                    <div className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1">
                      <span className="text-gray-500">Webhook URL:</span>
                      <button onClick={() => void copyText(suggestedUrl(providerGuides[provider.key].webhookPath))} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5">
                        <Copy size={11} />
                        نسخ
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {openGuideFor ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900">ملف شرح الإعداد - {providerLabels.find((p) => p.key === openGuideFor)?.label}</h3>
            <button onClick={() => setOpenGuideFor(null)} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs">إغلاق</button>
          </div>
          <a href={providerGuides[openGuideFor].sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 underline">
            {providerGuides[openGuideFor].sourceLabel}
            <ExternalLink size={14} />
          </a>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-white p-3">
              <div className="font-black text-sm">القيم التي تضعها هنا</div>
              <ul className="mt-2 list-disc space-y-1 pr-4 text-xs text-gray-700">
                {providerGuides[openGuideFor].fieldsHelp.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white p-3">
              <div className="font-black text-sm">ملاحظات مهمة</div>
              <ul className="mt-2 list-disc space-y-1 pr-4 text-xs text-gray-700">
                {providerGuides[openGuideFor].notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {providerGuides[openGuideFor].callbackPath ? (
                <div className="mt-2 rounded border border-gray-100 px-2 py-1 text-xs">
                  <div>Authorized Redirect URI:</div>
                  <code className="break-all">{suggestedUrl(providerGuides[openGuideFor].callbackPath)}</code>
                </div>
              ) : null}
              {providerGuides[openGuideFor].webhookPath ? (
                <div className="mt-2 rounded border border-gray-100 px-2 py-1 text-xs">
                  <div>Webhook URL:</div>
                  <code className="break-all">{suggestedUrl(providerGuides[openGuideFor].webhookPath)}</code>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {setupChecklist ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-black text-gray-900">جاهزية الربط الإنتاجي</h3>
            <button
              onClick={() => void loadSetupChecklist()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700"
            >
              <RefreshCw size={14} />
              تحديث القائمة
            </button>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">إجمالي التكاملات</div>
              <div className="font-black text-gray-900">{setupChecklist.summary.total}</div>
            </div>
            <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">المفعلة</div>
              <div className="font-black text-gray-900">{setupChecklist.summary.enabled}</div>
            </div>
            <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">مكتملة التفعيل</div>
              <div className="font-black text-gray-900">{setupChecklist.summary.configuredEnabled}</div>
            </div>
          </div>
          <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <div>Public Base URL: <code className="break-all">{setupChecklist.publicBaseUrl || "-"}</code></div>
            <div>API Base URL: <code className="break-all">{setupChecklist.apiBaseUrl || "-"}</code></div>
          </div>
          <div className="space-y-2">
            {setupChecklist.checks.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-gray-900">{item.title}</div>
                  <div className={`rounded-full px-2 py-0.5 text-xs font-black ${item.enabled ? (item.isConfigured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700") : "bg-gray-100 text-gray-600"}`}>
                    {item.enabled ? (item.isConfigured ? "مفعل ومكتمل" : "مفعل ناقص") : "غير مفعل"}
                  </div>
                </div>
                <div className="mb-1 text-xs text-gray-600">{item.notes}</div>
                {item.callbackUrl ? (
                  <div className="mb-1 flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1 text-xs">
                    <span className="text-gray-500">Callback URL</span>
                    <button onClick={() => void copyText(item.callbackUrl)} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5">
                      <Copy size={11} />
                      نسخ
                    </button>
                  </div>
                ) : null}
                {item.webhookUrl ? (
                  <div className="mb-1 flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1 text-xs">
                    <span className="text-gray-500">Webhook URL</span>
                    <button onClick={() => void copyText(item.webhookUrl)} className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-0.5">
                      <Copy size={11} />
                      نسخ
                    </button>
                  </div>
                ) : null}
                <div className="text-xs text-gray-600">ENV: {item.envKeys.join(" , ")}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {runtimeAudit ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-black text-gray-900">فحص التشغيل الفعلي (Runtime)</h3>
            <button
              onClick={() => void loadRuntimeAudit()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700"
            >
              <RefreshCw size={14} />
              تحديث الفحص
            </button>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">المفعل</div>
              <div className="font-black text-gray-900">{runtimeAudit.summary.enabled}</div>
            </div>
            <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">جاهز تشغيل فعلي</div>
              <div className="font-black text-gray-900">{runtimeAudit.summary.runtimeReady}</div>
            </div>
            <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">معطل بسبب نقص</div>
              <div className="font-black text-gray-900">{runtimeAudit.summary.blocked.length}</div>
            </div>
          </div>
          <div className="space-y-2">
            {runtimeAudit.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-gray-100 px-3 py-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-gray-900">{item.title}</div>
                  <div className={`rounded-full px-2 py-0.5 text-xs font-black ${item.enabled ? (item.runtimeReady ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700") : "bg-gray-100 text-gray-600"}`}>
                    {item.enabled ? (item.runtimeReady ? "جاهز فعليًا" : "مفعل لكن غير جاهز") : "غير مفعل"}
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  DB: {item.dbConfigured ? "مكتمل" : "ناقص"} | ENV: {item.envConfigured ? "مكتمل" : "ناقص"}
                </div>
                {item.health ? (
                  <div className="mt-1 text-xs text-gray-600">
                    Redis Health: {item.health.ok ? `ok (${item.health.latencyMs ?? "?"}ms)` : `fail (${item.health.status}${item.health.error ? ` - ${item.health.error}` : ""})`}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h3 className="text-lg font-black text-gray-900">اختبار إرسال التكاملات</h3>
        <p className="mt-1 text-sm text-gray-500">اختبار فعلي سريع للبريد أو الواتساب من نفس إعدادات التشغيل الحالية.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value as "email" | "whatsapp")}
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          {testChannel === "email" ? (
            <input
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="recipient@email.com"
            />
          ) : (
            <input
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="9665xxxxxxxx"
            />
          )}
          <input
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm md:col-span-2"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="نص رسالة الاختبار"
          />
          <div className="md:col-span-2">
            <button
              onClick={() => void sendIntegrationTest()}
              disabled={sendingTest}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {sendingTest ? "جارٍ الإرسال..." : "إرسال اختبار"}
            </button>
          </div>
          {testResult ? (
            <div className="md:col-span-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {testResult}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h3 className="text-lg font-black text-gray-900">زر التواصل العائم</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>تفعيل الزر العائم</span>
            <input type="checkbox" checked={settings.contactWidget.enabled} onChange={(e) => updateContactWidget("enabled", e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>فتح في تبويب جديد</span>
            <input type="checkbox" checked={settings.contactWidget.openInNewTab} onChange={(e) => updateContactWidget("openInNewTab", e.target.checked)} />
          </label>
          <select className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.contactWidget.channel} onChange={(e) => updateContactWidget("channel", e.target.value as "whatsapp" | "telegram" | "phone")}>
            <option value="whatsapp">WhatsApp</option>
            <option value="telegram">Telegram</option>
            <option value="phone">Phone</option>
          </select>
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.contactWidget.whatsappNumber} onChange={(e) => updateContactWidget("whatsappNumber", e.target.value)} placeholder="رقم الواتساب بصيغة دولية 9665xxxxxxx" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm md:col-span-2" value={settings.contactWidget.whatsappMessage} onChange={(e) => updateContactWidget("whatsappMessage", e.target.value)} placeholder="رسالة البداية" />
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>إظهار في الصفحات العامة</span>
            <input type="checkbox" checked={settings.contactWidget.showOnPublicPages} onChange={(e) => updateContactWidget("showOnPublicPages", e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>إظهار في لوحات المستخدمين</span>
            <input type="checkbox" checked={settings.contactWidget.showOnDashboardPages} onChange={(e) => updateContactWidget("showOnDashboardPages", e.target.checked)} />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <h3 className="text-lg font-black text-gray-900">إعدادات SEO والظهور في Google</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>تفعيل SEO</span>
            <input type="checkbox" checked={settings.seo.enabled} onChange={(e) => updateSeo("enabled", e.target.checked)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-sm">
            <span>السماح بالأرشفة (robots index)</span>
            <input type="checkbox" checked={settings.seo.robotsIndexingEnabled} onChange={(e) => updateSeo("robotsIndexingEnabled", e.target.checked)} />
          </label>
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.seo.siteName} onChange={(e) => updateSeo("siteName", e.target.value)} placeholder="اسم الموقع" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.seo.defaultTitle} onChange={(e) => updateSeo("defaultTitle", e.target.value)} placeholder="العنوان الافتراضي" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm md:col-span-2" value={settings.seo.defaultDescription} onChange={(e) => updateSeo("defaultDescription", e.target.value)} placeholder="الوصف الافتراضي" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.seo.canonicalBaseUrl} onChange={(e) => updateSeo("canonicalBaseUrl", e.target.value)} placeholder="Canonical Base URL" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.seo.defaultOgImage} onChange={(e) => updateSeo("defaultOgImage", e.target.value)} placeholder="OG Image URL" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.seo.googleSiteVerification} onChange={(e) => updateSeo("googleSiteVerification", e.target.value)} placeholder="Google Site Verification" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.seo.googleAnalyticsId} onChange={(e) => updateSeo("googleAnalyticsId", e.target.value)} placeholder="Google Analytics ID (G-XXXX)" />
          <input className="rounded-xl border border-gray-200 px-3 py-2 text-sm" value={settings.seo.googleTagManagerId} onChange={(e) => updateSeo("googleTagManagerId", e.target.value)} placeholder="Google Tag Manager ID (GTM-XXXX)" />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">ربط المنصات الخارجية (Eduoma وغيرها)</h3>
          <button onClick={addExternal} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
            <Plus size={14} />
            إضافة منصة
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {settings.externalPlatforms.map((platform) => (
            <div key={platform.id} className="grid grid-cols-1 gap-2 rounded-xl border border-gray-100 p-3 md:grid-cols-12">
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-2" value={platform.name} onChange={(e) => updateExternal(platform.id, { name: e.target.value })} placeholder="اسم المنصة" />
              <select className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-2" value={platform.platformType} onChange={(e) => updateExternal(platform.id, { platformType: e.target.value as ExternalPlatform["platformType"] })}>
                <option value="lms">LMS</option>
                <option value="marketplace">Marketplace</option>
                <option value="crm">CRM</option>
                <option value="custom">Custom</option>
              </select>
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-3" value={platform.baseUrl} onChange={(e) => updateExternal(platform.id, { baseUrl: e.target.value })} placeholder="API Base URL" />
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-2" value={platform.apiKey} onChange={(e) => updateExternal(platform.id, { apiKey: e.target.value })} placeholder="API Key" />
              <label className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-1">
                <input type="checkbox" checked={platform.enabled} onChange={(e) => updateExternal(platform.id, { enabled: e.target.checked })} />
                active
              </label>
              <button onClick={() => removeExternal(platform.id)} className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-black text-rose-700 md:col-span-1">
                <Trash2 size={14} />
              </button>
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-3" value={platform.webhookUrl} onChange={(e) => updateExternal(platform.id, { webhookUrl: e.target.value })} placeholder="Webhook URL" />
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-3" value={platform.webhookSecret} onChange={(e) => updateExternal(platform.id, { webhookSecret: e.target.value })} placeholder="Webhook Secret" />
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-3" value={platform.syncScheduleCron} onChange={(e) => updateExternal(platform.id, { syncScheduleCron: e.target.value })} placeholder="Sync schedule (cron)" />
              <label className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-1">
                <input type="checkbox" checked={platform.syncStudents} onChange={(e) => updateExternal(platform.id, { syncStudents: e.target.checked })} />
                طلاب
              </label>
              <label className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-1">
                <input type="checkbox" checked={platform.syncCourses} onChange={(e) => updateExternal(platform.id, { syncCourses: e.target.checked })} />
                كورسات
              </label>
              <label className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-1">
                <input type="checkbox" checked={platform.syncOrders} onChange={(e) => updateExternal(platform.id, { syncOrders: e.target.checked })} />
                طلبات
              </label>
            </div>
          ))}
          {settings.externalPlatforms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">لا توجد منصات خارجية مضافة.</div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900">حقول التسجيل المتقدمة</h3>
          <button onClick={addField} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
            <Plus size={14} />
            إضافة حقل
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {settings.registrationFields.map((field) => (
            <div key={field.id} className="grid grid-cols-1 gap-2 rounded-xl border border-gray-100 p-3 md:grid-cols-12">
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-2" value={field.key} onChange={(e) => updateField(field.id, { key: e.target.value })} placeholder="key" />
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-2" value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} placeholder="label" />
              <select className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-2" value={field.type} onChange={(e) => updateField(field.id, { type: e.target.value as RegistrationField["type"] })}>
                <option value="text">text</option>
                <option value="email">email</option>
                <option value="phone">phone</option>
                <option value="select">select</option>
                <option value="textarea">textarea</option>
              </select>
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-2" value={field.placeholder || ""} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} placeholder="placeholder" />
              <label className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-1">
                <input type="checkbox" checked={field.required} onChange={(e) => updateField(field.id, { required: e.target.checked })} />
                required
              </label>
              <label className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-1">
                <input type="checkbox" checked={field.enabled} onChange={(e) => updateField(field.id, { enabled: e.target.checked })} />
                active
              </label>
              <button onClick={() => removeField(field.id)} className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-xs font-black text-rose-700 md:col-span-1">
                <Trash2 size={14} />
              </button>
              <input className="rounded-lg border border-gray-200 px-2 py-2 text-xs md:col-span-12" value={field.helpText || ""} onChange={(e) => updateField(field.id, { helpText: e.target.value })} placeholder="help text" />
            </div>
          ))}
          {settings.registrationFields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">لا توجد حقول إضافية حالياً.</div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-lg font-black text-gray-900">سجل تغييرات التكاملات</h3>
          <button
            onClick={() => void loadHistory()}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700"
          >
            <RefreshCw size={14} />
            تحديث السجل
          </button>
        </div>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
            لا توجد لقطات محفوظة حتى الآن.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
                <div className="text-xs text-gray-600">
                  <div className="font-black text-gray-800">{entry.note || "تعديل إعدادات التكاملات"}</div>
                  <div>{entry.createdAt ? new Date(entry.createdAt).toLocaleString("ar-EG") : "-"}</div>
                  <div>by: {entry.updatedBy || "-"}</div>
                </div>
                <button
                  onClick={() => void restoreSnapshot(entry._id)}
                  disabled={restoringId === entry._id}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 disabled:opacity-60"
                >
                  {restoringId === entry._id ? "جارٍ الاسترجاع..." : "استرجاع هذه النسخة"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 text-sm text-indigo-800">
        <h3 className="mb-2 text-base font-black">دليل سريع للربط</h3>
        <ul className="space-y-1">
          <li className="flex items-start gap-2"><Radio size={14} className="mt-1" /> Google/Facebook: ضع Client ID/Secret + Callback URL ثم فعّل المزود.</li>
          <li className="flex items-start gap-2"><Radio size={14} className="mt-1" /> WhatsApp/Telegram: ضع Token + Webhook URL + Verify token، ثم اختبر الاستقبال.</li>
          <li className="flex items-start gap-2"><Radio size={14} className="mt-1" /> Zoom/Meet/Teams/YouTube Live: أضف مفاتيح OAuth/API وحدد callback ثم اربطها مع الدروس الحية.</li>
          <li className="flex items-start gap-2"><Radio size={14} className="mt-1" /> SEO: أضف site verification + GA/GTM + canonical ثم احفظ.</li>
          <li className="flex items-start gap-2"><Radio size={14} className="mt-1" /> Eduoma أو منصة خارجية: أضف base URL + API keys + webhook وفعل مزامنة الطلاب/الكورسات.</li>
        </ul>
      </div>
    </div>
  );
};

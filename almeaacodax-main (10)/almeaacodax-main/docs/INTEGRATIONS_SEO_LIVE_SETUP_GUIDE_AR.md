# دليل ربط التكاملات وSEO والبث المباشر

آخر تحديث: 2026-05-14

## أين ستجد الإعدادات داخل المنصة؟

- لوحة المدير:
  - `#/admin-dashboard?tab=platform-integrations`
- من نفس الصفحة ستجد:
  - تسجيل الدخول الاجتماعي
  - WhatsApp / Telegram
  - Email / Sentry / Redis
  - Zoom / Google Meet / Teams / YouTube Live
  - SEO
  - المنصات الخارجية (Eduoma وغيرها)

## 1) Google Login

المطلوب منك:
1. افتح Google Cloud Console.
2. أنشئ OAuth Client (Web application).
3. أضف Authorized redirect URI (نفس Callback URL في المنصة).
4. انسخ:
   - Client ID
   - Client Secret

ضع القيم في:
- Google provider داخل لوحة التكاملات.
- وأيضًا في Render env:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`

## 2) Facebook Login

المطلوب منك:
1. افتح Meta for Developers.
2. أنشئ App ثم Facebook Login (Web).
3. أضف Valid OAuth Redirect URI.
4. انسخ:
   - App ID
   - App Secret

ضعها في قسم Facebook داخل لوحة التكاملات.

## 3) WhatsApp (OTP/Notifications)

المطلوب منك:
1. Meta Business > WhatsApp Cloud API.
2. جهّز:
   - Access Token
   - Phone Number ID
   - Business Account ID
   - Verify Token
3. ضع Webhook URL (Endpoint السيرفر لديك).

ضعها في قسم WhatsApp داخل لوحة التكاملات + Render env حسب البنية الحالية.

## 4) Telegram

المطلوب:
1. من BotFather أنشئ Bot.
2. احصل على:
   - Bot Token
   - Bot Username
   - Chat ID (لو ستستخدم broadcasting).
3. أضف webhook URL.

## 5) Email Provider

يمكن استخدام Resend/SendGrid/Mailgun/SMTP.
المطلوب الأساسي:
- API key أو SMTP credentials.
- From email.

ضعها في Email provider داخل لوحة التكاملات + env للسيرفر.

## 6) Sentry

المطلوب:
- DSN
- Environment (production/staging)

ضعها في Sentry provider + env:
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`

## 7) Redis Managed

المطلوب:
- Redis URL (Upstash أو Redis Cloud)

ضعها في Redis provider + env:
- `REDIS_URL`

## 8) البث المباشر والحصص أونلاين

### Zoom
- Client ID + Client Secret + Callback URL.

### Google Meet
- OAuth project (غالبًا نفس Google Cloud مع scopes مناسبة).
- Client ID + Secret + Callback.

### Microsoft Teams
- Entra/Azure app registration.
- Client ID + Secret + Redirect URI.

### YouTube Live
- YouTube Data API key أو OAuth حسب السيناريو.

ضع هذه القيم في providers الخاصة بكل مزود داخل لوحة التكاملات.

## 9) SEO والظهور في Google

في قسم SEO داخل لوحة التكاملات:
- Site name
- Default title / description
- Keywords
- Canonical base URL
- Google Site Verification
- Google Analytics ID
- GTM ID
- Robots indexing enable/disable
- No-index paths

بعد الحفظ:
1. أضف الموقع في Google Search Console.
2. استخدم كود verification نفسه.
3. ارفع sitemap:
   - `https://almeaacodax.vercel.app/sitemap.xml`

## 10) ربط منصات خارجية (Eduoma وغيرها)

لكل منصة خارجية أضف:
- API Base URL
- API Key / Secret
- Webhook URL / Secret
- نوع المنصة (LMS/Marketplace/CRM/Custom)
- تحديد المزامنة:
  - طلاب
  - كورسات
  - طلبات
- جدول مزامنة (Cron)

هذه البنية جاهزة للإضافة التدريجية بدون كسر الشكل العام.

## اختبار سريع بعد الإعداد

1. احفظ من لوحة التكاملات.
2. شغل readiness check.
3. اختبر endpoint:
   - `/api/operations/integrations-readiness`
4. الحالة المطلوبة: `ready` أو `ready_with_notes` بدون فشل حرج.

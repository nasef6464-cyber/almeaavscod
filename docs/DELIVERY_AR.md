# وثيقة تسليم المشروع - منصة المئة التعليمية

آخر تحديث: 2026-05-28
الفرع: `main`
آخر commit: `84edcfd`

---

## 1. الروابط الحية

| الخدمة | الرابط | الحالة |
|--------|--------|--------|
| API (Backend) | https://almeaavscod.onrender.com | ✅ live |
| الواجهة (Frontend) | https://almeaavscod.vercel.app | ✅ live |
| GitHub | https://github.com/nasef6464-cyber/almeaavscod | ✅ |
| قاعدة البيانات | PostgreSQL على Render (Supabase) | ✅ متصلة |

## 2. حالة المكونات

### ✅ شغال
- تسجيل مستخدم جديد (`POST /api/auth/register`)
- تسجيل دخول (`POST /api/auth/login`)
- تسجيل خروج (`POST /api/auth/logout`)
- الصحة: `/api/health`, `/live`, `/ready`, `/scale-ready`
- التصنيفات (taxonomy): paths, levels, subjects, sections, skills
- JWT authentication مع fallback Bearer token
- CSRF protection
- Google OAuth
- AI (Gemini) - `/api/ai/chat`
- قاعدة البيانات PostgreSQL متصلة

### ❌ مشاكل معروفة
1. **مشكلة الـ cookies cross-origin** — اتحلت: الحين دايمًا نرسل Bearer token من sessionStorage.
2. **TypeScript warnings** — ~90 خطأ (مش مانعة الشغل).
3. **Redis مش مفعل** — `/scale-ready` يرجع `scaleReady: false` (مطلوب لو عايز توسع أفقي).
4. **Smoke contracts اللي بتفحص MongoDB patterns** — بتفشل طبيعي لأن المشروع PG مش Mongo.

## 3. المفاتيح والبيانات (Env Vars على Render)

| المتغير | القيمة |
|---------|--------|
| `JWT_SECRET` | the-hundred-platform-super-secret-2026-admin-key ⚠️ **يجب تغييره** |
| `DATABASE_URL` | `postgresql://almeaavscod_user:...@dpg-.../almeaavscod` |
| `USE_POSTGRES` | `true` |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | موجود ✅ |
| `GOOGLE_OAUTH_ENABLED` | `true` |
| `GOOGLE_CLIENT_ID` | `1052206444252-2rlo16clb2kv0hbdql34qnltrhpdqiqa.apps.googleusercontent.com` |
| `NODE_ENV` | `production` |

## 4. إزاي ترفع تعديل جديد؟

```bash
git add -A
git commit -m "وصف التعديل"
git push origin main
```
Vercel و Render بينشروا تلقائياً.

## 5. خطوات الأمان المهمة

### ⚠️ غير JWT_SECRET
روح على Render Dashboard:
1. افتح الخدمة بتاعتك
2. Environment → **JWT_SECRET**
3. غيّره لقيمة طويلة عشوائية (مثال: `openssl rand -base64 32`)
4. Save

### ⚠️ غير GOOGLE_CLIENT_SECRET
نفس الخطوات.

## 6. لو حابب تضيف Redis للتوسع

- احجز Redis instance (مثلاً من Render أو Upstash)
- ضيف `REDIS_URL` في Environment على Render
- `/scale-ready` يرجع `scaleReady: true`

---

تم التسليم بنجاح ✅

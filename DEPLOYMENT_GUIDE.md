# دليل الربط والنشر - منصة المئة التعليمية

## 🔗 الربط بين الخدمات

```
GitHub (الكود) → Vercel (Frontend) → Render (Backend) → Supabase (Database)
```

---

## 1️⃣ GitHub - رفع الكود

### مشكلة الصلاحيات (403)
لو ظهرت رسالة `Permission denied` أو `403`:

**الحل أ: Personal Access Token (PAT)**
1. اروح على: https://github.com/settings/tokens
2. اضغط **Generate new token (classic)**
3. اختار الصلاحيات: `repo`, `workflow`, `admin:repo_hook`
4. انسخ التوكن (مش هتظهر تاني!)
5. استخدمه في الـ push:
   ```bash
   git remote set-url origin https://<TOKEN>@github.com/nasef6464-cyber/almeaavscod.git
   git push origin main
   ```

**الحل ب: SSH Key**
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
# انسخ المفتاح وحطه في: https://github.com/settings/keys
git remote set-url origin git@github.com:nasef6464-cyber/almeaavscod.git
git push origin main
```

---

## 2️⃣ Supabase - قاعدة البيانات

### إنشاء قاعدة بيانات جديدة
1. اروح على: https://supabase.com
2. **New Project** → اسم المشروع + باسوورد
3. انتظر لحد ما المشروع يجهز (~2 دقيقة)
4. اروح على **Project Settings** → **Database**
5. انسخ **Connection string** (URI mode)

### تطبيق الـ Schema
```bash
# في مجلد المشروع
cd "C:\ALMEAA MAY - codax - Copy"

# حدّث DATABASE_URL في server/.env
# DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

# طبق الـ schema
npx drizzle-kit push
```

### الجداول اللي هتتنشأ تلقائياً (28 جدول)
| القسم | الجداول |
|-------|---------|
| Users | `users` |
| Taxonomy | `paths`, `levels`, `subjects`, `sections`, `skills` |
| Courses | `courses`, `lessons`, `topics` |
| Quizzes | `questions`, `quizzes`, `quiz_results`, `question_attempts`, `skill_progress` |
| Commerce | `b2b_packages`, `access_codes`, `payment_requests`, `payment_settings`, `study_plans` |
| System | `groups`, `library_items`, `homepage_settings`, `activities` |
| Certificates | `certificates` |
| Notifications | `notification_templates`, `notification_deliveries` |
| Monitoring | `admin_audit_logs`, `ai_interactions`, `client_events` |
| Commerce Ext | `discount_codes`, `access_grants`, `announcement_ads`, `platform_integration_settings` |
| Backups | `backup_snapshots`, `backup_activities` |

---

## 3️⃣ Render - Backend Server

### إنشاء خدمة جديدة
1. اروح على: https://render.com
2. **New +** → **Web Service**
3. اختار **Connect** مع GitHub repo: `almeaavscod`
4. الإعدادات:

| الإعداد | القيمة |
|---------|--------|
| **Name** | `almeaa-platform-server` |
| **Region** | Frankfurt (أقرب للشرق الأوسط) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/server.js` |
| **Plan** | Free (أو Starter بـ $7/شهر) |

### Environment Variables (في Render Dashboard)
```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:5432/postgres
USE_POSTGRES=true
JWT_SECRET=<ضع-سلسلة-عشوائية-طويلة-هنا>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://almeaa-platform.vercel.app
CORS_ALLOWED_ORIGINS=https://almeaa-platform.vercel.app,http://localhost:3000

# AI (اختياري)
AI_PROVIDER=gemini
GEMINI_API_KEY=<your-gemini-key>
GEMINI_MODEL=gemini-2.5-flash

# Notifications (اختياري)
NOTIFICATION_QUEUE_ENABLED=false
EMAIL_PROVIDER=console
WHATSAPP_PROVIDER=console

# Admin
ADMIN_NAME=Platform Admin
ADMIN_EMAIL=admin@almeaaplatform.com
ADMIN_PASSWORD=<strong-admin-password>

# Google OAuth (اختياري)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_REDIRECT_URI=https://almeaa-platform-server.onrender.com/api/auth/google/callback

# File Upload
MAX_FILE_SIZE=10485760
```

### بعد النشر
- الـ URL هيكون: `https://almeaa-platform-server.onrender.com`
- اختبر الـ health endpoint: `https://almeaa-platform-server.onrender.com/api/health`

---

## 4️⃣ Vercel - Frontend

### إنشاء مشروع جديد
1. اروح على: https://vercel.com
2. **Add New...** → **Project**
3. اختار **Import** من GitHub repo: `almeaavscod`
4. الإعدادات:

| الإعداد | القيمة |
|---------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `./` (المجلد الرئيسي) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Environment Variables (في Vercel Dashboard)
```
VITE_API_URL=https://almeaa-platform-server.onrender.com/api
VITE_SENTRY_DSN=<your-sentry-dsn>
VITE_SENTRY_ENVIRONMENT=production
```

### تحديث vercel.json
حدّث الـ `destination` في `vercel.json` بالـ URL الجديد من Render:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://almeaa-platform-server.onrender.com/api/:path*"
    }
  ]
}
```

### بعد النشر
- الـ URL هيكون: `https://almeaa-platform.vercel.app`

---

## 5️⃣ ربط كل حاجة مع بعض

### ترتيب النشر الصحيح
1. **Supabase** ← الأول (قاعدة البيانات)
2. **Render** ← التاني (الـ Backend)
3. **Vercel** ← التالت (الـ Frontend)

### بعد النشر
1. افتح `https://almeaa-platform.vercel.app`
2. سجّل حساب جديد
3. جرب الـ dashboard
4. تأكد إن الـ API بيشتغل من Network tab

---

## 🔧 أوامر مفيدة

```bash
# رفع التحديثات لـ GitHub
git add -A
git commit -m "feat: update description"
git push origin main

# Vercel هينشر تلقائياً بعد كل push
# Render هينشر تلقائياً بعد كل push

# اختبار الـ API محلياً
cd server
npm run dev

# اختبار الـ Frontend محلياً
npm run dev

# تطبيق تغييرات الـ schema
npx drizzle-kit push

# فحص حالة الـ migrations
npm --prefix server run db:status
```

---

## ⚠️ ملاحظات مهمة

1. **Free Tier Limits:**
   - Render Free: بيروح sleep بعد 15 دقيقة من عدم الاستخدام (أول request ياخد ~30 ثانية)
   - Supabase Free: 500MB database, 2GB bandwidth
   - Vercel Free: 100GB bandwidth

2. **للإنتاج (Production):**
   - Render Starter: $7/شهر (بدون sleep)
   - Supabase Pro: $25/شهر
   - استخدم Custom Domain

3. **الأمان:**
   - متشاركش الـ `.env` files على GitHub
   - استخدم `.gitignore` (موجود بالفعل)
   - غيّر الـ `JWT_SECRET` لسلسلة عشوائية طويلة

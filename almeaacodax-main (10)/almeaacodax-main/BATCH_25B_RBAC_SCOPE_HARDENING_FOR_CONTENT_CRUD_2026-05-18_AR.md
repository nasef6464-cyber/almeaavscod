# تقرير الدفعة 25B — RBAC Scope Hardening for Content CRUD
**التاريخ:** 2026-05-18
**الحالة:** Programmatically closed, production verification pending

## الهدف
إغلاق فجوات RBAC Scope المتبقية في مسارات CRUD داخل content API (بدون توسيع النطاق لباقي النظام).

## ما تم
- إضافة حواجز Scope صريحة لمسارات:
  - `PATCH/DELETE /api/content/topics/:id`
  - `PATCH/DELETE /api/content/groups/:id`
  - `POST/PATCH/DELETE /api/content/b2b-packages*`
  - `POST/PATCH/DELETE /api/content/access-codes*`
- تفاصيل الحماية:
  - `topics`: التعديل/الحذف لغير admin أصبح مرتبطًا بـ `managedPathIds/managedSubjectIds`.
  - `groups`: التعديل/الحذف لغير admin أصبح مشروطًا بملكية/إشراف فعلي أو نطاق مدرسة supervisor.
  - `b2b-packages` و `access-codes`: supervisor لا يستطيع التعديل/الإنشاء/الحذف خارج مدارس نطاقه.
- أضفت smoke contract جديد:
  - `scripts/smoke-rbac-content-crud-scope-contract.mjs`
- Hotfix واجهة مرتبط بطلبك المباشر:
  - إصلاح نصوص `????` في `AdvancedCourseBuilder`.

## الملفات المعدلة
- `server/src/routes/content.routes.ts`
- `scripts/smoke-rbac-content-crud-scope-contract.mjs`
- `dashboards/admin/AdvancedCourseBuilder.tsx`
- `BATCH_25B_RBAC_SCOPE_HARDENING_FOR_CONTENT_CRUD_2026-05-18_AR.md`
- `PROJECT_STATUS.md`
- `docs/SPARK_BATCH_LEDGER_AR.md`

## الفحوص
- `npm --prefix server run build`: PASS
- `node scripts/smoke-rbac-content-crud-scope-contract.mjs`: PASS
- `node scripts/smoke-rbac-school-scope-contract.mjs`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run smoke:course-builder`: PASS
- `npm run smoke:production-hardening`: PASS
- `npm run smoke:health-readiness`: PASS
- `npm run smoke:api-phase4`: PASS

## فحص الإنتاج
- `https://almeaacodax-k2ux.onrender.com/api/health`: PASS
  - `ready=true`
  - `commit=27e3e8905517` (نفس دفعة hardening)
- `https://almeaacodax.vercel.app/`: HTTP 200
- ما زال مطلوبًا التحقق الحي النهائي متعدد الأدوار (admin/supervisor) على endpoints الهدف.

## التحقق اليدوي المقترح
1. الدخول كـ supervisor ومحاولة تعديل/حذف package أو access code خارج مدرسته -> يجب `403`.
2. الدخول كـ supervisor على مدرسة ضمن نطاقه -> يسمح بالعمليات.
3. الدخول كـ admin -> العمليات تستمر طبيعيًا.
4. فتح باني المناهج والتأكد أن النصوص العربية ظهرت سليمة (بدون `????`).

## المخاطر المتبقية
- التحقق الحي متعدد الأدوار على الإنتاج ما زال مطلوبًا قبل إعلان Fully closed.

## الدفعة التالية المقترحة
- BATCH 27 — Sentry Production Verification (فقط إذا أردت إعادة التحقق الإنتاجي الحي رغم أن فحوص المراقبة الحالية ناجحة ومؤرشفة مسبقًا)

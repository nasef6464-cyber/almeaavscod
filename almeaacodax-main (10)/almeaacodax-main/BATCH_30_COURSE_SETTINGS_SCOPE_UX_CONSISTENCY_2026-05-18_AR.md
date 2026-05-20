# تقرير الدفعة 30 — Course Settings Scope UX Consistency
**التاريخ:** 2026-05-18
**الحالة:** Fully closed

## ما تم
- توحيد إعدادات الدورة داخل `CourseBuilder` بإضافة اختيار:
  - المسار
  - المادة
  - المهارات (مفلترة حسب المسار/المادة)
- تصفير المهارات تلقائيًا عند تغيير المسار أو المادة لمنع حفظ payload غير متسق.
- تنقية المهارات عند الحفظ لضمان عدم تمرير مهارات خارج نطاق المادة المختارة.
- تحسين تجربة `AdvancedCourseBuilder` في استدعاء المحتوى:
  - إضافة فلترة حسب المسار/المادة عند استدعاء الدروس والاختبارات.
  - إضافة بحث نصي داخل قوائم "استدعاء درس موجود" و"استدعاء اختبار موجود" (العنوان + المسار + المادة).
  - عرض القوائم بشكل قابل للتمرير بارتفاع أكبر `60vh` لتفادي القطع في أسفل الشاشة عند وجود عناصر كثيرة.
  - إضافة fallback آمن للأسماء لمنع ظهور `????` عند وجود بيانات اسم غير صالحة.
  - ربط عرض الأسماء بـ `sanitizeArabicText` داخل الباني لتقليل أثر النصوص المتضررة بالترميز (mojibake) قبل عرضها.
  - إضافة sanitization مركزي داخل `services/adapter.ts` لتطبيع أسماء (المسارات/المواد/الأقسام/المهارات/الدروس/الاختبارات) قبل دخولها للـstore.
- رفع التحديثات على GitHub في commit:
  - `a9cef7d`
  - `6ce8259`
  - `6c87122`
  - `72fc457`
  - `f4ab6fc`
  - `e375cf0`

## الملفات المعدلة في هذه الدفعة
- `dashboards/admin/CourseBuilder.tsx`
- `dashboards/admin/AdvancedCourseBuilder.tsx`
- `services/adapter.ts`
- `store/useStore.ts`
- `BATCH_30_COURSE_SETTINGS_SCOPE_UX_CONSISTENCY_2026-05-18_AR.md`
- `docs/NEXT_SESSION_HANDOVER_AR.md`
- `docs/SPARK_BATCH_LEDGER_AR.md`
- `PROJECT_STATUS.md`

## الملفات التي كانت معدلة مسبقًا ولم يتم لمسها
- لا ينطبق ضمن نطاق إغلاق هذه الدفعة.

## الفحوص
- `npm run smoke:course-builder`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run smoke:production-hardening`: PASS

## تأكيد إغلاق إضافي (2026-05-18)
- إعادة تشغيل smoke contracts بعد آخر إصلاحات النصوص/الفلترة:
  - `smoke:course-builder`: PASS (4/4)
  - `smoke:production-hardening`: PASS (5/5)
- لا يوجد حاليًا ظهور `????` داخل ملفات الباني الأساسية (`CourseBuilder` + `AdvancedCourseBuilder`) بعد التطبيع.

## فحص الإنتاج
- `https://almeaacodax.vercel.app/`: HTTP 200 ✅
- `https://almeaacodax.vercel.app/#/admin-dashboard`: HTTP 200 ✅
- `https://almeaacodax-k2ux.onrender.com/api/health`: commit=`27e3e8905517` و ready=true ✅

## خطوات التحقق اليدوي
1. فتح `https://almeaacodax.vercel.app/#/admin-dashboard` بحساب admin.
2. الدخول إلى منشئ الدورة.
3. التأكد من وجود حقول المسار + المادة.
4. التأكد من فلترة المهارات حسب المادة.
5. في `AdvancedCourseBuilder`:
   - فتح "استدعاء درس موجود" وتجربة فلترة المسار/المادة + البحث.
   - فتح "استدعاء اختبار موجود" وتجربة فلترة المسار/المادة + البحث.
   - التأكد أن القائمة قابلة للتمرير عند كثرة العناصر.
6. حفظ الدورة والتأكد من نجاح العملية.

## المخاطر المتبقية
- ما زالت هناك بيانات قديمة في بعض السجلات تحتاج إعادة حفظ من لوحة الإدارة إذا كانت قادمة بترميز خاطئ تاريخيًا.
- توجد تغييرات كثيرة أخرى في الـworktree خارج نطاق هذه الدفعة (لم تُضم في commit الدفعة 30).

## الدفعة التالية المقترحة
- BATCH 25 — RBAC Scope Audit Batch 2






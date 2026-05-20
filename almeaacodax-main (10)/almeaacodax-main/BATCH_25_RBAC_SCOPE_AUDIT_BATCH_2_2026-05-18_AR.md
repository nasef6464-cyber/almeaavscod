# تقرير الدفعة 25 — RBAC Scope Audit Batch 2
**التاريخ:** 2026-05-18
**الحالة:** Programmatically closed, production verification pending

## سبب الدفعة
استكمال تدقيق RBAC بعد دفعة 09 مع تركيز خاص على صلاحيات Supervisor/Teacher/Parent ونطاق المدارس في مسارات المحتوى الحساسة.

## نطاق الدفعة
- تدقيق أمني فقط (Audit-only) بدون تعديل سلوك المنتج.
- مراجعة المسارات الحساسة في:
  - `server/src/routes/content.routes.ts`
  - `server/src/middleware/auth.ts`
- مقارنة الفجوات الحالية مع نتائج BATCH 09.

## ما تم فحصه
1. آلية التوثيق والتفويض (`requireAuth`, `requireRole`) وتحديث الدور من قاعدة البيانات.
2. مسارات المدارس الحساسة:
   - `GET /api/content/schools/:id/report`
   - `POST /api/content/schools/:id/import-students`
3. مسارات CRUD التي كانت مرشحة لخطر scope:
   - `topics`
   - `groups`
   - `b2b-packages`
   - `access-codes`

## النتيجة الفنية (ملخص)
- ✅ تم إغلاق الخطر الحرج السابق الخاص بالمدارس:
  - `schools/:id/report` و `schools/:id/import-students` أصبحا يستخدمان `assertSchoolManagementScope`.
- ⚠️ ما زالت توجد فجوات Scope عالية في بعض CRUD:
  - `PATCH/DELETE /topics/:id` يعتمد `buildDocumentQuery` مباشرة (بدون ملكية/نطاق مدرسة صريح).
  - `PATCH/DELETE /groups/:id` يعتمد `buildDocumentQuery` مباشرة.
  - `PATCH/DELETE /b2b-packages/:id` يعتمد `buildDocumentQuery` مباشرة.
  - `PATCH/DELETE /access-codes/:id` يعتمد `buildDocumentQuery` مباشرة.
- التقييم: لا يوجد الآن CRITICAL مكشوف بنفس حدة دفعة 09 في مسارات المدارس المذكورة، لكن ما زالت HIGH gaps في CRUD تتطلب دفعة Hardening تنفيذية مستقلة.

## تصنيف المخاطر الحالي
- Critical:
  - لا يوجد خطر حرج جديد مثبت ضمن النطاق الذي تمت مراجعته.
- High:
  - Scope enforcement غير موحد في CRUD (`topics/groups/b2b-packages/access-codes`).
- Medium:
  - الحاجة لاختبارات RBAC runtime إنتاجية متعددة الأدوار على كل endpoint CRUD المتأثر.
- Low:
  - لا ينطبق ضمن هذا النطاق.

## الملفات المعدلة في هذه الدفعة
- `BATCH_25_RBAC_SCOPE_AUDIT_BATCH_2_2026-05-18_AR.md`
- `PROJECT_STATUS.md`
- `docs/SPARK_BATCH_LEDGER_AR.md`

## الملفات التي كانت معدلة مسبقًا ولم يتم لمسها
- جميع ملفات الكود الأخرى خارج نطاق التدقيق.

## الفحوص
- لا ينطبق (دفعة تدقيق فقط بدون تنفيذ كود).

## فحص الإنتاج
- مطلوب في دفعة التنفيذ التالية (Hardening) بعد تطبيق الإصلاحات، وليس ضمن هذا التدقيق.

## خطوات التحقق اليدوي المقترحة (للدفعة التالية)
1. اختبار Supervisor على `PATCH/DELETE topics/groups/b2b-packages/access-codes` لعنصر خارج نطاقه المدرسي.
2. التوقع: `403` في جميع الحالات خارج النطاق.
3. اختبار Admin لنفس المسارات: نجاح طبيعي.
4. توثيق النتائج عبر smoke RBAC runtime.

## هل الدفعة مغلقة نهائيًا؟
- لا.
- السبب: هذه دفعة تدقيق (Audit) وأثبتت فجوات تحتاج دفعة إصلاح تنفيذية.

## الدفعة التالية المقترحة
- **BATCH 25B — RBAC Scope Hardening for Content CRUD**
  - الهدف: توحيد enforcement (ownership/school scope) على `topics/groups/b2b-packages/access-codes` في update/delete.

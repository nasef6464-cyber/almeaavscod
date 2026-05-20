# BATCH_15R_CONTENT_BOOTSTRAP_SCOPE_HARDENING_CLOSURE_2026-05-17_AR

التاريخ: 2026-05-17
اسم الدفعة: BATCH 15R — Content Bootstrap Scope Hardening Closure
الحالة: Fully closed

## السبب
إغلاق ملاحظة الدفعة 15 التي كانت Programmatically closed عبر فرض scope آمن للزوار وغير الطاقم.

## ما تم
- تعديل `/api/content/bootstrap` لفرض `scope=learning` تلقائيًا لغير الطاقم حتى عند طلب `scope=full`.
- الحفاظ على `scope=full` للأدوار المصرح لها (staff) فقط.
- إضافة هيدر تشخيصي `X-Content-Scope` لتأكيد النطاق المستخدم فعليًا.

## الملفات المعدلة
- `server/src/routes/content.routes.ts`
- `PROJECT_STATUS.md`
- `docs/SPARK_BATCH_LEDGER_AR.md`
- `BATCH_15R_CONTENT_BOOTSTRAP_SCOPE_HARDENING_CLOSURE_2026-05-17_AR.md`

## الفحوص
- `npm --prefix server run build`: PASS
- `npm run smoke:health-readiness`: PASS
- `npm run smoke:data-visibility-regression`: PASS (28/28)

## تحقق حي على الإنتاج
- `GET /api/content/bootstrap?scope=full` بدون auth => `200` مع هيدر `x-content-scope: learning`.
- القيم التشغيلية في payload للضيف: `groups=0`, `b2bPackages=0`, `accessCodes=0`, `studyPlans=0`.

## المخاطر المتبقية
- لا يوجد ضمن نطاق هذه الدفعة.

## القرار
تم اعتماد BATCH 15 بحالة Fully closed بعد تحقق برمجي + تحقق حي.

## الدفعة التالية المقترحة
BATCH 16R — Auth Cookie Migration Outcome Verification Closure
